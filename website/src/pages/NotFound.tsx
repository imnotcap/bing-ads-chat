import { Accent, ButtonLink, Container } from '@site/lib/ui';

export function NotFound() {
  return (
    <section className="relative isolate -mt-[68px] pb-24 pt-[160px]">
      <div aria-hidden className="bg-aurora absolute inset-x-0 top-0 -z-10 h-[520px]" />
      <Container className="flex flex-col items-center text-center">
        <p className="text-[96px] font-extrabold leading-none tracking-[-0.05em] text-ink/10">404</p>
        <h1 className="mt-2 text-[34px] font-bold tracking-[-0.03em] text-ink">
          Siden findes <Accent>ikke</Accent>
        </h1>
        <p className="mt-3 text-[16px] text-muted">Linket er måske gammelt, eller siden er flyttet.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/" arrow>
            Til forsiden
          </ButtonLink>
          <ButtonLink href="/download" variant="ghost">
            Hent XavierOS
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
