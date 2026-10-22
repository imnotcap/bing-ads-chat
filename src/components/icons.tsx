/**
 * The app's icons: Phosphor (https://phosphoricons.com) in its solid "fill" weight –
 * line-only glyphs (arrows, rounded chevrons, ×, ✓, +) in "bold", since they have no fill. The
 * names are the ones the app used before (from lucide), so components import icons
 * from here by the same names. Any icon takes `weight` to override, e.g. an empty circle.
 */
import * as P from '@phosphor-icons/react';
import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from 'react';

export interface IconProps extends P.IconProps {
  /** Ignored (line icons only) – kept so older call sites type-check. */
  strokeWidth?: number | string;
}

export type LucideIcon = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

function icon(Base: P.Icon, weight: P.IconWeight = 'fill', mirror = false): LucideIcon {
  const C = forwardRef<SVGSVGElement, IconProps>(({ strokeWidth: _ignored, style, ...props }, ref) => (
    <Base ref={ref} weight={weight} size={24} aria-hidden={props['aria-label'] ? undefined : true} style={mirror ? { transform: 'scaleX(-1)', ...style } : style} {...props} />
  ));
  C.displayName = Base.displayName;
  return C;
}

const bold = (Base: P.Icon) => icon(Base, 'bold');

export const Activity = bold(P.Pulse);
export const AlertCircle = icon(P.WarningCircle);
export const AlertTriangle = icon(P.Warning);
export const Archive = icon(P.Archive);
export const ArrowDown = bold(P.ArrowDown);
export const ArrowDownRight = bold(P.ArrowDownRight);
export const ArrowDownToLine = bold(P.DownloadSimple);
export const ArrowDownUp = bold(P.ArrowsDownUp);
export const ArrowLeft = bold(P.ArrowLeft);
export const ArrowRight = bold(P.ArrowRight);
export const ArrowUp = bold(P.ArrowUp);
export const ArrowUpRight = bold(P.ArrowUpRight);
export const Ban = icon(P.Prohibit);
export const BarChart3 = icon(P.ChartBar);
export const Bell = icon(P.Bell);
export const Bot = icon(P.Robot);
export const Boxes = icon(P.Cube);
export const Brain = icon(P.Brain);
export const Building2 = icon(P.Buildings);
export const CalendarCheck = icon(P.CalendarCheck);
export const CalendarClock = icon(P.CalendarDots);
export const CalendarDays = icon(P.CalendarBlank);
export const CalendarPlus = icon(P.CalendarPlus);
export const ChartColumn = icon(P.ChartBar);
export const Check = bold(P.Check);
export const CheckCheck = bold(P.Checks);
export const CheckCircle2 = icon(P.CheckCircle);
export const CheckSquare = icon(P.CheckSquare);
export const ChevronDown = bold(P.CaretDown);
export const ChevronLeft = bold(P.CaretLeft);
export const ChevronRight = bold(P.CaretRight);
export const ChevronUp = bold(P.CaretUp);
export const ChevronsUp = bold(P.CaretDoubleUp);
/** An empty circle (a task not done yet) – outlined on purpose. */
export const Circle = bold(P.Circle);
export const CircleCheck = icon(P.CheckCircle);
export const CircleDashed = bold(P.CircleDashed);
export const CircleSlash = icon(P.Prohibit);
export const ClipboardCopy = icon(P.ClipboardText);
export const ClipboardPaste = icon(P.Clipboard);
export const Clock = icon(P.Clock);
export const Clock3 = icon(P.Clock);
export const Coins = icon(P.Coins);
export const Columns3 = icon(P.Columns);
export const Copy = icon(P.Copy);
export const CornerDownLeft = bold(P.ArrowElbowDownLeft);
export const Cpu = icon(P.Cpu);
export const Crosshair = icon(P.Crosshair);
export const Database = icon(P.Database);
export const Download = bold(P.DownloadSimple);
export const EllipsisVertical = bold(P.DotsThreeVertical);
export const Equal = bold(P.Equals);
export const ExternalLink = bold(P.ArrowSquareOut);
export const Eye = icon(P.Eye);
export const EyeOff = icon(P.EyeSlash);
export const FileSpreadsheet = icon(P.FileXls);
export const FileText = icon(P.FileText);
export const Filter = icon(P.Funnel);
export const Flag = icon(P.Flag);
export const FlaskConical = icon(P.Flask);
export const FolderOpen = icon(P.FolderOpen);
export const Globe = icon(P.Globe);
export const GraduationCap = icon(P.GraduationCap);
export const GripVertical = bold(P.DotsSixVertical);
export const Hand = icon(P.Hand);
export const Hash = bold(P.Hash);
export const ImageIcon = icon(P.Image);
export const ImageOff = icon(P.ImageBroken);
export const Info = icon(P.Info);
export const KeyRound = icon(P.Key);
export const Layers = icon(P.Stack);
export const LayoutDashboard = icon(P.SquaresFour);
export const LayoutGrid = icon(P.GridFour);
export const LayoutList = icon(P.Rows);
export const Lightbulb = icon(P.Lightbulb);
export const ListPlus = bold(P.ListPlus);
export const Loader2 = bold(P.SpinnerGap);
export const Lock = icon(P.Lock);
export const LogIn = bold(P.SignIn);
export const LogOut = bold(P.SignOut);
export const Mail = icon(P.Envelope);
export const Menu = bold(P.List);
export const MessageSquare = icon(P.ChatCircle);
export const MessageSquareText = icon(P.ChatCircleText);
export const Mic = icon(P.Microphone);
export const Minus = bold(P.Minus);
export const MoreHorizontal = bold(P.DotsThree);
export const MoreVertical = bold(P.DotsThreeVertical);
export const OctagonPause = icon(P.PauseCircle);
export const OctagonX = icon(P.XCircle);
export const Package = icon(P.Package);
export const PackageX = icon(P.Package);
export const Palette = icon(P.Palette);
export const PanelLeft = icon(P.SidebarSimple);
export const PanelRight = icon(P.SidebarSimple, 'fill', true);
export const PanelRightClose = icon(P.SidebarSimple, 'fill', true);
export const PanelTop = icon(P.Browser);
export const Paperclip = bold(P.Paperclip);
export const Pause = icon(P.Pause);
export const PenLine = icon(P.PencilLine);
export const Pencil = icon(P.PencilSimple);
export const PencilLine = icon(P.PencilLine);
export const Pin = icon(P.PushPin);
export const Play = icon(P.Play);
export const Plug = icon(P.Plug);
export const PlugZap = icon(P.PlugCharging);
export const Plus = bold(P.Plus);
export const Power = bold(P.Power);
export const RefreshCw = bold(P.ArrowsClockwise);
export const RotateCcw = bold(P.ArrowCounterClockwise);
export const Rows3 = icon(P.Rows);
export const Scale = icon(P.Scales);
export const Search = bold(P.MagnifyingGlass);
export const Settings = icon(P.Gear);
export const Settings2 = icon(P.GearSix);
export const Share = icon(P.Export);
export const Shield = icon(P.Shield);
export const ShieldAlert = icon(P.ShieldWarning);
export const ShieldCheck = icon(P.ShieldCheck);
export const ShieldOff = icon(P.ShieldSlash);
export const ShoppingBag = icon(P.ShoppingBag);
export const Sparkles = icon(P.Sparkle);
/** The maximise button and the stop square – outlined unless asked for (weight="fill"). */
export const Square = bold(P.Square);
export const SquareKanban = icon(P.Kanban);
export const SquarePen = icon(P.NotePencil);
export const Tag = icon(P.Tag);
export const Terminal = icon(P.Terminal);
export const Text = bold(P.TextAlignLeft);
export const Trash2 = icon(P.Trash);
export const TrendingDown = bold(P.TrendDown);
export const TrendingUp = bold(P.TrendUp);
export const TriangleAlert = icon(P.Warning);
export const Undo2 = bold(P.ArrowUUpLeft);
export const Unplug = icon(P.Plugs);
export const Upload = bold(P.UploadSimple);
export const User = icon(P.User);
export const UserMinus = icon(P.UserMinus);
export const UserPlus = icon(P.UserPlus);
export const UserRound = icon(P.User);
export const Users = icon(P.Users);
export const UsersRound = icon(P.UsersThree);
export const Wallet = icon(P.Wallet);
export const WifiOff = icon(P.WifiSlash);
export const X = bold(P.X);
export const XCircle = icon(P.XCircle);
export const Zap = icon(P.Lightning);
