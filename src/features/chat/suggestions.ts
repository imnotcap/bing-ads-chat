import { BarChart3, Coins, FileText, FlaskConical, Lightbulb, PenLine, Scale, Search, ShieldCheck, Wallet, type LucideIcon } from 'lucide-react';
import { TEST_COMMAND, startFollowUpTest } from './followUpTest';

export interface Suggestion {
  icon: LucideIcon;
  title: string;
  prompt: string;
  tone: 'brand' | 'violet' | 'teal' | 'amber';
}

export const SUGGESTIONS: Suggestion[] = [
  { icon: BarChart3, title: 'Giv mig et overblik over kontoen og hvad jeg skal holde øje med', prompt: 'Giv mig et overblik over kontoens performance i den valgte periode – hvad går godt, og hvad skal jeg holde øje med?', tone: 'brand' },
  { icon: Search, title: 'Find søgetermer der koster penge uden at konvertere', prompt: 'Find søgetermer der koster penge uden at konvertere, og foreslå negative søgeord.', tone: 'violet' },
  { icon: Wallet, title: 'Hvilke kampagner er begrænset af budget?', prompt: 'Hvilke kampagner er begrænset af budget, og hvor ville ekstra budget give mest afkast?', tone: 'teal' },
  { icon: Scale, title: 'Fordel budgettet bedre', prompt: 'Hvordan bør jeg fordele mit budget mellem kampagnerne for at få flest konverteringer til en fornuftig CPA? Vis det med en graf.', tone: 'amber' },
  { icon: PenLine, title: 'Skriv nye annoncer', prompt: 'Gennemgå annoncerne i den kampagne med mest forbrug, og skriv en ny responsiv søgeannonce, der kan teste mod den bedste.', tone: 'violet' },
  { icon: Lightbulb, title: 'Nye søgeord', prompt: 'Find nye relevante søgeord med god volumen til mine bedste kampagner.', tone: 'teal' },
  { icon: FileText, title: 'Ugerapport', prompt: 'Lav en ugerapport for de seneste 7 dage sammenlignet med ugen før, med grafer og de vigtigste anbefalinger.', tone: 'brand' },
  { icon: Coins, title: 'Forbrug og prognose', prompt: 'Hvor meget har vi brugt denne måned, og hvad bliver prognosen for hele måneden?', tone: 'amber' },
];

/** `prompt` is put in the chat field; `run` does something in the app instead (no AI). */
export const SLASH_COMMANDS: { command: string; label: string; prompt: string; icon: LucideIcon; run?: () => void }[] = [
  { command: '/overblik', label: 'Overblik over kontoen', prompt: SUGGESTIONS[0]!.prompt, icon: BarChart3 },
  { command: '/spild', label: 'Find spildte søgetermer', prompt: SUGGESTIONS[1]!.prompt, icon: Search },
  { command: '/budget', label: 'Budgetbegrænsede kampagner', prompt: SUGGESTIONS[2]!.prompt, icon: Wallet },
  { command: '/fordeling', label: 'Optimal budgetfordeling', prompt: SUGGESTIONS[3]!.prompt, icon: Scale },
  { command: '/annonce', label: 'Skriv en ny annonce', prompt: SUGGESTIONS[4]!.prompt, icon: PenLine },
  { command: '/søgeord', label: 'Find nye søgeord', prompt: SUGGESTIONS[5]!.prompt, icon: Lightbulb },
  { command: '/rapport', label: 'Ugerapport med grafer', prompt: SUGGESTIONS[6]!.prompt, icon: FileText },
  { command: '/forbrug', label: 'Forbrug og prognose', prompt: SUGGESTIONS[7]!.prompt, icon: Coins },
  { command: '/ændringer', label: 'Hvad er der ændret?', prompt: 'Hvilke ændringer er der lavet for nylig, og hvordan har de påvirket resultaterne?', icon: ShieldCheck },
  { command: TEST_COMMAND, label: 'Test opfølgning: planlægning, Outlook og mail (uden Microsoft Ads og AI)', prompt: TEST_COMMAND, icon: FlaskConical, run: startFollowUpTest },
];
