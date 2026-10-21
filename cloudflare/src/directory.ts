/**
 * The register of companies using XavierOS (one Durable Object for the whole service).
 * Each company has its own Workspace (cloudflare/src/workspace.ts) with its people,
 * connections, boards and AI-usage pool; this object only knows which company a
 * person belongs to, the invitations, the e-mail domains that join automatically, and
 * the short-lived tickets used to create a new company after a Microsoft sign-in.
 *
 * Inventarland's workspace from before companies existed is the company "main".
 * Only the Worker talks to it (https://directory/...); it is never reachable from outside.
 */
import { DurableObject } from 'cloudflare:workers';
import { isPlanId, type PlanId } from '../../src/workspace/plans';
import type { CompanyInfo, Invitation, Role } from '../../src/workspace/types';
import type { MicrosoftIdentity } from './auth';
import type { Env } from './workspace';

const TICKET_MINUTES = 30;
export const LEGACY_COMPANY = 'main';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const fail = (error: string, status: number) => json({ error }, status);

function randomId(bytes: number) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => alphabet[b % 36]).join('');
}

const domainOf = (email: string) => email.split('@')[1]?.toLowerCase() ?? '';
const list = (v?: string) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

/** Free mail services never join a company by domain. */
const PUBLIC_DOMAINS = new Set(['gmail.com', 'hotmail.com', 'outlook.com', 'live.com', 'live.dk', 'yahoo.com', 'icloud.com', 'msn.com', 'hotmail.dk', 'outlook.dk', 'mail.dk', 'jubii.dk']);

export type Lookup = { companyId: string; role: Role | null } | { ticket: string };

export class Directory extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const sql = ctx.storage.sql;
    sql.exec(`CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY, name TEXT NOT NULL, plan TEXT NOT NULL, created_at INTEGER NOT NULL, created_by TEXT NOT NULL)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS members (email TEXT PRIMARY KEY, company_id TEXT NOT NULL)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS invites (email TEXT PRIMARY KEY, company_id TEXT NOT NULL, role TEXT NOT NULL, invited_by TEXT NOT NULL, at INTEGER NOT NULL)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS domains (domain TEXT PRIMARY KEY, company_id TEXT NOT NULL)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, who TEXT NOT NULL, expires INTEGER NOT NULL)`);
  }

  private get sql() {
    return this.ctx.storage.sql;
  }

  /** Inventarland's workspace from before companies existed. */
  private ensureLegacy() {
    if (this.sql.exec('SELECT 1 FROM companies WHERE id = ?', LEGACY_COMPANY).toArray().length) return;
    this.sql.exec('INSERT INTO companies (id, name, plan, created_at, created_by) VALUES (?, ?, ?, ?, ?)', LEGACY_COMPANY, 'Inventarland', 'teams', Date.now(), 'system');
    for (const d of list(this.env.ALLOWED_DOMAINS)) this.sql.exec('INSERT OR IGNORE INTO domains (domain, company_id) VALUES (?, ?)', d, LEGACY_COMPANY);
  }

  company(id: string): CompanyInfo | null {
    const c = this.sql.exec<{ id: string; name: string; plan: string; created_at: number }>('SELECT id, name, plan, created_at FROM companies WHERE id = ?', id).toArray()[0];
    if (!c) return null;
    const domains = this.sql.exec<{ domain: string }>('SELECT domain FROM domains WHERE company_id = ? ORDER BY domain', id).toArray().map((d) => d.domain);
    return { id: c.id, name: c.name, plan: isPlanId(c.plan) ? c.plan : 'teams', createdAt: c.created_at, domains };
  }

  companyIds(): string[] {
    this.ensureLegacy();
    return this.sql.exec<{ id: string }>('SELECT id FROM companies').toArray().map((c) => c.id);
  }

  /** Which company a person signs in to: member, invited, by e-mail domain – or none yet. */
  async lookup(who: MicrosoftIdentity): Promise<Lookup> {
    this.ensureLegacy();
    const email = who.email.toLowerCase();
    const member = this.sql.exec<{ company_id: string }>('SELECT company_id FROM members WHERE email = ?', email).toArray()[0];
    if (member && this.company(member.company_id)) return { companyId: member.company_id, role: null };
    const invite = this.sql.exec<{ company_id: string; role: string }>('SELECT company_id, role FROM invites WHERE email = ?', email).toArray()[0];
    if (invite && this.company(invite.company_id)) {
      this.join(email, invite.company_id);
      return { companyId: invite.company_id, role: invite.role === 'admin' ? 'admin' : 'member' };
    }
    const domain = domainOf(email);
    const byDomain = domain && !PUBLIC_DOMAINS.has(domain) ? this.sql.exec<{ company_id: string }>('SELECT company_id FROM domains WHERE domain = ?', domain).toArray()[0] : undefined;
    if (byDomain && this.company(byDomain.company_id)) {
      this.join(email, byDomain.company_id);
      return { companyId: byDomain.company_id, role: null };
    }
    // People who used Inventarland's workspace before companies existed.
    const legacy = this.env.WORKSPACE.get(this.env.WORKSPACE.idFromName(LEGACY_COMPANY));
    const known = (await (await legacy.fetch('https://workspace/internal/knows', { method: 'POST', body: JSON.stringify({ email }) })).json()) as { known: boolean };
    if (known.known) {
      this.join(email, LEGACY_COMPANY);
      return { companyId: LEGACY_COMPANY, role: null };
    }
    const ticket = `t_${randomId(32)}`;
    this.sql.exec('DELETE FROM tickets WHERE expires < ?', Date.now());
    this.sql.exec('INSERT INTO tickets (id, who, expires) VALUES (?, ?, ?)', ticket, JSON.stringify(who), Date.now() + TICKET_MINUTES * 60_000);
    return { ticket };
  }

  private join(email: string, companyId: string) {
    this.sql.exec('INSERT OR REPLACE INTO members (email, company_id) VALUES (?, ?)', email, companyId);
    this.sql.exec('DELETE FROM invites WHERE email = ?', email);
  }

  /** Creates a company for the person behind the ticket, who becomes its first admin. */
  signup(ticket: string, name: string, plan: PlanId): { company: CompanyInfo; who: MicrosoftIdentity } | string {
    const row = this.sql.exec<{ who: string; expires: number }>('SELECT who, expires FROM tickets WHERE id = ?', ticket).toArray()[0];
    if (!row || row.expires < Date.now()) return 'Log ind med Microsoft igen – oprettelsen udløb.';
    const who = JSON.parse(row.who) as MicrosoftIdentity;
    const email = who.email.toLowerCase();
    if (this.sql.exec('SELECT 1 FROM members WHERE email = ?', email).toArray().length) return 'Du hører allerede til en virksomhed – log ind i stedet.';
    const clean = name.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (clean.length < 2) return 'Skriv virksomhedens navn.';
    const id = randomId(12);
    this.sql.exec('INSERT INTO companies (id, name, plan, created_at, created_by) VALUES (?, ?, ?, ?, ?)', id, clean, plan, Date.now(), email);
    this.join(email, id);
    this.sql.exec('DELETE FROM tickets WHERE id = ?', ticket);
    return { company: this.company(id)!, who };
  }

  update(companyId: string, patch: { name?: string; plan?: PlanId; domains?: string[] }): CompanyInfo | string {
    const c = this.company(companyId);
    if (!c) return 'Virksomheden findes ikke.';
    if (patch.name !== undefined) {
      const clean = patch.name.trim().replace(/\s+/g, ' ').slice(0, 80);
      if (clean.length < 2) return 'Skriv virksomhedens navn.';
      this.sql.exec('UPDATE companies SET name = ? WHERE id = ?', clean, companyId);
    }
    if (patch.plan !== undefined) this.sql.exec('UPDATE companies SET plan = ? WHERE id = ?', patch.plan, companyId);
    if (patch.domains !== undefined) {
      const wanted = [...new Set(patch.domains.map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean))];
      for (const d of wanted) {
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return `"${d}" er ikke et domæne.`;
        if (PUBLIC_DOMAINS.has(d)) return `${d} er en offentlig mailtjeneste og kan ikke bruges.`;
        const owner = this.sql.exec<{ company_id: string }>('SELECT company_id FROM domains WHERE domain = ?', d).toArray()[0];
        if (owner && owner.company_id !== companyId) return `${d} hører allerede til en anden virksomhed.`;
      }
      this.sql.exec('DELETE FROM domains WHERE company_id = ?', companyId);
      for (const d of wanted) this.sql.exec('INSERT INTO domains (domain, company_id) VALUES (?, ?)', d, companyId);
    }
    return this.company(companyId)!;
  }

  invites(companyId: string): Invitation[] {
    return this.sql
      .exec<{ email: string; role: string; invited_by: string; at: number }>('SELECT email, role, invited_by, at FROM invites WHERE company_id = ? ORDER BY at DESC', companyId)
      .toArray()
      .map((i) => ({ email: i.email, role: i.role === 'admin' ? 'admin' : 'member', invitedBy: i.invited_by, at: i.at }));
  }

  invite(companyId: string, email: string, role: Role, invitedBy: string): Invitation[] | string {
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return 'Skriv en gyldig e-mailadresse.';
    const member = this.sql.exec<{ company_id: string }>('SELECT company_id FROM members WHERE email = ?', clean).toArray()[0];
    if (member) return member.company_id === companyId ? 'Personen er allerede med i virksomheden.' : 'Personen hører til en anden virksomhed i XavierOS.';
    this.sql.exec('INSERT OR REPLACE INTO invites (email, company_id, role, invited_by, at) VALUES (?, ?, ?, ?, ?)', clean, companyId, role, invitedBy, Date.now());
    return this.invites(companyId);
  }

  uninvite(companyId: string, email: string): Invitation[] {
    this.sql.exec('DELETE FROM invites WHERE email = ? AND company_id = ?', email.toLowerCase(), companyId);
    return this.invites(companyId);
  }

  /** Someone was removed from a company: they can sign in again only when invited. */
  removed(companyId: string, email: string) {
    this.sql.exec('DELETE FROM members WHERE email = ? AND company_id = ?', email.toLowerCase(), companyId);
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const body = req.method === 'GET' ? {} : ((await req.json()) as Record<string, unknown>);
    const companyId = String(body.companyId ?? url.searchParams.get('company') ?? '');
    switch (url.pathname) {
      case '/lookup':
        return json(await this.lookup(body.who as MicrosoftIdentity));
      case '/signup': {
        const plan = isPlanId(body.plan) ? body.plan : 'teams';
        const r = this.signup(String(body.ticket ?? ''), String(body.name ?? ''), plan);
        return typeof r === 'string' ? fail(r, 400) : json(r);
      }
      case '/company': {
        const c = this.company(companyId);
        return c ? json(c) : fail('Virksomheden findes ikke.', 404);
      }
      case '/companies':
        return json({ ids: this.companyIds() });
      case '/update': {
        const r = this.update(companyId, body as { name?: string; plan?: PlanId; domains?: string[] });
        return typeof r === 'string' ? fail(r, 400) : json(r);
      }
      case '/invites':
        return json({ invites: this.invites(companyId) });
      case '/invite': {
        const r = this.invite(companyId, String(body.email ?? ''), body.role === 'admin' ? 'admin' : 'member', String(body.invitedBy ?? ''));
        return typeof r === 'string' ? fail(r, 400) : json({ invites: r });
      }
      case '/uninvite':
        return json({ invites: this.uninvite(companyId, String(body.email ?? '')) });
      case '/removed':
        this.removed(companyId, String(body.email ?? ''));
        return json({ ok: true });
      default:
        return fail('Ikke fundet.', 404);
    }
  }
}
