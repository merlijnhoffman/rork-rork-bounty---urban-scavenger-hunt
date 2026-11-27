import { MotionPlayer, type SceneContent, type SceneRenderProps } from "./motion-player";
import { easeOut, type Transition } from "motion";
import { motion, useTransform, type MotionValue } from "motion/react";

// BOUNTY — "Find it first" promo film. Portrait 9:16 (1080 × 1920), ~31 s.
// Brand: dark minimal (#0C0C0E) with amber (#F59E0B), flat 2D.
//
// The player sizes its surface to the window with [container-type:inline-size], so
// every size here is in cqw: 1cqw = 1% of the composition width = 10.8px at full
// 1080 × 1920 resolution. Text must never use absolute px.
type FilmScene = SceneContent &
  (
    | { id: "hook"; kicker: string; headline: string; subline: string }
    | { id: "streets"; video: { src: string; sourceStart: number; volume: number }; badge: string; wordmark: string; tagline: string }
    | { id: "map"; shot: string; chip: string }
    | { id: "pool"; pot: string; kicker: string; note: string }
    | { id: "connect"; chip: string; subline: string }
    | { id: "steal"; headline: string; subline: string }
    | { id: "end"; icon: string; wordmark: string; line: string }
  );

const content: FilmScene[] = [
  {
    id: "hook",
    kicker: "URBAN SCAVENGER HUNT",
    headline: "SOMEONE IN\nYOUR CITY",
    subline: "is holding the prize.",
    voiceover: "/rork-vo-hook-v1.mp3",
    effects: [{ src: "/rork-sfx-whoosh-v1.mp3", at: 0.1, volume: 0.3 }],
  },
  {
    id: "streets",
    video: { src: "/rork-clip-streets-v1.mp4", sourceStart: 0.5, volume: 0 },
    badge: "LIVE",
    wordmark: "BOUNTY",
    tagline: "The whole city is the board.",
  },
  {
    id: "map",
    shot: "/bounty-map-v1.png",
    chip: "EVERY HUNTER. REAL TIME.",
    voiceover: "/rork-vo-map-v1.mp3",
    effects: [{ src: "/rork-sfx-ping-v1.mp3", at: 0.6, volume: 0.3 }],
  },
  {
    id: "pool",
    pot: "/bounty-prize-pot-v1.png",
    kicker: "EVERY TICKET GROWS THE POT",
    note: "Winner takes all",
    voiceover: "/rork-vo-pool-v1.mp3",
    effects: [{ src: "/rork-sfx-chime-v1.mp3", at: 3.7, volume: 0.3 }],
  },
  {
    id: "connect",
    chip: "HUNTER CONNECT",
    subline: "Pair up. Share the hunt.",
    voiceover: "/rork-vo-connect-v1.mp3",
  },
  {
    id: "steal",
    headline: "TAKE THE\nBOUNTY",
    subline: "The whole pool goes to whoever holds it.",
    voiceover: "/rork-vo-steal-v1.mp3",
  },
  {
    id: "end",
    icon: "/bounty-icon-v2.png",
    wordmark: "BOUNTY",
    line: "FIND IT FIRST.",
    voiceover: "/rork-vo-end-v1.mp3",
    effects: [{ src: "/rork-sfx-whoosh-v1.mp3", at: 0.15, volume: 0.3 }],
  },
];

// Narrated scenes: their clip's measured length drives the scene duration
// (0.3 s lead-in + clip + 0.6 s tail). Video scenes time from the clip.
const SCENE_SECONDS: Record<string, number> = {
  hook: 0.3 + 4.48 + 0.6,
  streets: 4.2,
  map: 0.3 + 3.92 + 0.6,
  pool: 0.3 + 3.52 + 0.6,
  connect: 0.3 + 3.84 + 0.6,
  steal: 0.3 + 3.84 + 0.6,
  end: Math.max(0.3 + 2.24 + 0.9, 4.0),
};

const contentWithDurations = content.map((scene) => ({
  ...scene,
  seconds: scene.seconds ?? SCENE_SECONDS[scene.id] ?? 4,
}));

const musicBed: string | null = "/rork-music-v1.mp3";

const TRANSITION_SECONDS = 0.5;

// A clock-consistent entrance transition: same duration and ease on every scene.
const settle: Transition = { duration: 0.6, ease: easeOut };

type SceneProps<Id extends FilmScene["id"]> = SceneRenderProps<Extract<FilmScene, { id: Id }>>;

/** Mount on the index route; the player supplies the clock, media sync, controls and MP4 export. */
export default function MotionPresentation() {
  // The player's surface fills its container's width and takes its height from the
  // composition's aspect ratio; cap it so a portrait film and its control bar both
  // fit any window, as the template's own wrapper does.
  return (
    <div className="min-h-dvh w-full bg-[#0C0C0E] flex items-center justify-center">
      <div style={{ width: "min(100%, calc(80dvh * 9 / 16))" }}>
        <MotionPlayer
          content={contentWithDurations}
          musicBed={musicBed}
          width={1080}
          height={1920}
          surfaceClassName="bg-[#0C0C0E]"
          Scene={FilmSceneView}
          transitionSeconds={TRANSITION_SECONDS}
        />
      </div>
    </div>
  );
}

function FilmSceneView(props: SceneRenderProps<FilmScene>) {
  const { scene } = props;
  switch (scene.id) {
    case "hook":
      return <HookScene {...props} scene={scene} />;
    case "streets":
      return <StreetsScene {...props} scene={scene} />;
    case "map":
      return <MapScene {...props} scene={scene} />;
    case "pool":
      return <PoolScene {...props} scene={scene} />;
    case "connect":
      return <ConnectScene {...props} scene={scene} />;
    case "steal":
      return <StealScene {...props} scene={scene} />;
    case "end":
      return <EndScene {...props} scene={scene} />;
  }
}

/* Shared bits */

const AMBER = "#F59E0B";

function Reticle({ clock, size, opacity }: { clock: MotionValue<number>; size: string; opacity?: number }) {
  // Clock-driven pulse: one full breath every 1.6 s, identical on every seek.
  const pulse = useTransform(clock, (t) => 1 + 0.06 * Math.sin((t / 1.6) * Math.PI * 2));
  return (
    <motion.div
      style={{ width: size, height: size, opacity: opacity ?? 1, scale: pulse }}
      className="relative flex items-center justify-center"
    >
      <div className="absolute inset-0 rounded-full border-[0.28cqw]" style={{ borderColor: AMBER }} />
      <div className="absolute inset-[14%] rounded-full border-[0.19cqw] opacity-40" style={{ borderColor: AMBER }} />
      <div className="absolute left-1/2 top-0 h-[18%] w-[0.28cqw] -translate-x-1/2" style={{ background: AMBER }} />
      <div className="absolute left-1/2 bottom-0 h-[18%] w-[0.28cqw] -translate-x-1/2" style={{ background: AMBER }} />
      <div className="absolute top-1/2 left-0 w-[18%] h-[0.28cqw] -translate-y-1/2" style={{ background: AMBER }} />
      <div className="absolute top-1/2 right-0 w-[18%] h-[0.28cqw] -translate-y-1/2" style={{ background: AMBER }} />
      <div className="rounded-full" style={{ width: "2cqw", height: "2cqw", background: AMBER }} />
    </motion.div>
  );
}

/* Scene 1 — Hook: reticle on black, the premise */
function HookScene({ scene, active, clock }: SceneProps<"hook">) {
  return (
    <div className="absolute inset-0 bg-[#0C0C0E] flex flex-col items-center justify-center px-[8.9cqw]">
      {/* faint radial glow */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 80% 45% at 50% 46%, rgba(245,158,11,0.10), transparent 70%)" }}
      />
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={active ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0 }}
        transition={{ ...settle, delay: 0.1 }}
        className="mb-[5.2cqw]"
      >
        <Reticle clock={clock} size="20.4cqw" />
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: "2.2cqw" }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: "2.2cqw" }}
        transition={{ ...settle, delay: 0.45 }}
        className="text-[2.8cqw] tracking-[0.5em] mb-[3cqw]"
        style={{ color: "#8A8A93", fontFamily: "Inter, system-ui, sans-serif" }}
      >
        {scene.kicker}
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: "3.7cqw" }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: "3.7cqw" }}
        transition={{ ...settle, delay: 0.65 }}
        className="text-[9.6cqw] leading-[1.02] font-black text-center whitespace-pre-line"
        style={{ color: "#FAFAFA", fontFamily: "Inter, system-ui, sans-serif", letterSpacing: "-0.02em" }}
      >
        {scene.headline}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: "2.8cqw" }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: "2.8cqw" }}
        transition={{ ...settle, delay: 1.0 }}
        className="text-[5cqw] font-bold mt-[3.2cqw]"
        style={{ color: AMBER, fontFamily: "Inter, system-ui, sans-serif" }}
      >
        {scene.subline}
      </motion.p>
    </div>
  );
}

/* Scene 2 — Streets clip with logo lockup */
function StreetsScene({ scene, active, video }: SceneProps<"streets">) {
  return (
    <div className="absolute inset-0 bg-[#0C0C0E]">
      <div className="absolute inset-0 overflow-hidden">{video}</div>
      {/* cinematic grade: top and bottom gradients keep type legible */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(12,12,14,0.55) 0%, rgba(12,12,14,0.0) 30%, rgba(12,12,14,0.0) 45%, rgba(12,12,14,0.9) 88%)" }} />
      <motion.div
        initial={{ opacity: 0, y: "3.7cqw" }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: "3.7cqw" }}
        transition={{ ...settle, delay: 0.35 }}
        className="absolute left-[5.9cqw] right-[13cqw] bottom-[24%]"
      >
        <span
          className="inline-block rounded-full px-[2.2cqw] py-[0.9cqw] text-[2.6cqw] font-black tracking-[0.25em] mb-[3cqw]"
          style={{ background: AMBER, color: "#0C0C0E", fontFamily: "Inter, system-ui, sans-serif" }}
        >
          {scene.badge}
        </span>
        <h2
          className="text-[11.9cqw] font-black leading-none"
          style={{ color: "#FAFAFA", fontFamily: "Inter, system-ui, sans-serif", letterSpacing: "0.02em" }}
        >
          {scene.wordmark}
        </h2>
        <p className="text-[3.7cqw] font-medium mt-[1.5cqw]" style={{ color: "rgba(250,250,250,0.85)", fontFamily: "Inter, system-ui, sans-serif" }}>
          {scene.tagline}
        </p>
      </motion.div>
    </div>
  );
}

/* Scene 3 — Live map screenshot with radar pings */
function MapScene({ scene, active, clock }: SceneProps<"map">) {
  // Ping rings every 1.4 s, purely from the clock.
  const pingT = useTransform(clock, (t) => (t % 1.4) / 1.4);
  const pingScale = useTransform(pingT, [0, 1], [0.4, 2.6]);
  const pingOpacity = useTransform(pingT, [0, 0.15, 1], [0.9, 0.6, 0]);
  return (
    <div className="absolute inset-0 bg-[#0C0C0E] flex flex-col items-center justify-center">
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 90% 40% at 50% 42%, rgba(245,158,11,0.08), transparent 70%)" }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 1.06 }}
        animate={active ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.06 }}
        transition={{ ...settle }}
        className="relative overflow-hidden rounded-[4.4cqw] border-[0.19cqw]"
        style={{ width: "78%", borderColor: "rgba(245,158,11,0.35)", boxShadow: "0 0 120px rgba(245,158,11,0.15)" }}
      >
        <img src={scene.shot} alt="" className="w-full" />
        {/* ping on the hunt zone */}
        <motion.div
          style={{
            scale: pingScale,
            opacity: pingOpacity,
            borderColor: AMBER,
            left: "36%",
            top: "36%",
            width: "28%",
            height: "10%",
          }}
          className="absolute rounded-full border-[0.37cqw]"
        />
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: "2.2cqw" }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: "2.2cqw" }}
        transition={{ ...settle, delay: 0.5 }}
        className="text-[3.1cqw] font-bold tracking-[0.3em] mt-[4.4cqw]"
        style={{ color: AMBER, fontFamily: "Inter, system-ui, sans-serif" }}
      >
        {scene.chip}
      </motion.p>
    </div>
  );
}

/* Scene 4 — Prize pot with a clock-driven climbing pool */
function PoolScene({ scene, active, clock }: SceneProps<"pool">) {
  // Counter climbs €3 → €1,000 across the first 3.2 s of the scene, from the clock.
  const euros = useTransform(clock, (t) => {
    const p = Math.min(Math.max((t - scene.start) / 3.2, 0), 1);
    const eased = 1 - Math.pow(1 - p, 3);
    return Math.round(3 + eased * 997);
  });
  const euroText = useTransform(euros, (v) => `€${v.toLocaleString("en-US")}`);
  return (
    <div className="absolute inset-0 bg-[#0C0C0E] flex flex-col items-center justify-center px-[7.4cqw]">
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 70% 40% at 50% 40%, rgba(245,158,11,0.14), transparent 70%)" }}
      />
      <motion.p
        initial={{ opacity: 0, y: "2.2cqw" }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: "2.2cqw" }}
        transition={{ ...settle, delay: 0.2 }}
        className="text-[3.1cqw] font-bold tracking-[0.3em] mb-[3.7cqw]"
        style={{ color: AMBER, fontFamily: "Inter, system-ui, sans-serif" }}
      >
        {scene.kicker}
      </motion.p>
      <motion.img
        src={scene.pot}
        alt=""
        initial={{ opacity: 0, scale: 0.7 }}
        animate={active ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
        transition={{ ...settle, delay: 0.35 }}
        className="w-[46%] mb-[1.9cqw]"
        style={{ filter: "drop-shadow(0 0 60px rgba(245,158,11,0.35))" }}
      />
      <motion.h2
        initial={{ opacity: 0, y: "2.8cqw" }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: "2.8cqw" }}
        transition={{ ...settle, delay: 0.55 }}
        className="text-[13.9cqw] font-black leading-none tabular-nums"
        style={{ color: "#FAFAFA", fontFamily: "Inter, system-ui, sans-serif" }}
      >
        {euroText}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={active ? { opacity: 1 } : { opacity: 0 }}
        transition={{ ...settle, delay: 0.9 }}
        className="text-[3.3cqw] font-semibold tracking-[0.2em] mt-[3.2cqw]"
        style={{ color: "rgba(250,250,250,0.6)", fontFamily: "Inter, system-ui, sans-serif" }}
      >
        {scene.note.toUpperCase()}
      </motion.p>
    </div>
  );
}

/* Scene 5 — Hunter Connect: two dots converge on a radar */
function ConnectScene({ scene, active, clock }: SceneProps<"connect">) {
  // Dots drift toward each other over the scene, from the clock.
  const approach = useTransform(clock, (t) => {
    const p = Math.min(Math.max((t - scene.start) / 3.0, 0), 1);
    return 1 - Math.pow(1 - p, 2);
  });
  const leftX = useTransform(approach, [0, 1], [-17.6, -4.3]);
  const rightX = useTransform(approach, [0, 1], [17.6, 4.3]);
  const sweep = useTransform(clock, (t) => (t - scene.start) * 130);
  const dotPing = useTransform(clock, (t) => 1 + 0.35 * Math.sin((t / 0.8) * Math.PI * 2));
  return (
    <div className="absolute inset-0 bg-[#0C0C0E] flex flex-col items-center justify-center">
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 80% 40% at 50% 45%, rgba(245,158,11,0.10), transparent 70%)" }}
      />
      {/* radar scope */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={active ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
        transition={{ ...settle, delay: 0.2 }}
        className="relative rounded-full border-[0.19cqw] overflow-hidden"
        style={{ width: "57.4cqw", height: "57.4cqw", borderColor: "rgba(245,158,11,0.4)" }}
      >
        <div className="absolute inset-[16%] rounded-full border-[0.19cqw] opacity-50" style={{ borderColor: "rgba(245,158,11,0.35)" }} />
        <div className="absolute inset-[34%] rounded-full border-[0.19cqw] opacity-50" style={{ borderColor: "rgba(245,158,11,0.3)" }} />
        <div className="absolute left-1/2 top-0 bottom-0 w-[0.09cqw] opacity-30" style={{ background: "rgba(245,158,11,0.4)" }} />
        <div className="absolute top-1/2 left-0 right-0 h-[0.09cqw] opacity-30" style={{ background: "rgba(245,158,11,0.4)" }} />
        {/* rotating sweep, one turn every 3 s */}
        <motion.div style={{ rotate: sweep }} className="absolute inset-0">
          <div
            className="absolute left-1/2 top-1/2 h-[0.09cqw] origin-left"
            style={{ width: "50%", background: `linear-gradient(90deg, ${AMBER}, transparent)` }}
          />
        </motion.div>
        {/* two hunters converging */}
        <motion.div style={{ x: leftX }} className="absolute left-1/2 top-1/2 -ml-[1.5cqw] -mt-[1.5cqw]">
          <div className="relative">
            <div className="w-[3cqw] h-[3cqw] rounded-full" style={{ background: AMBER }} />
            <motion.div
              style={{ scale: dotPing }}
              className="absolute inset-0 rounded-full border-[0.19cqw]"
            />
          </div>
        </motion.div>
        <motion.div style={{ x: rightX }} className="absolute left-1/2 top-1/2 -ml-[1.5cqw] -mt-[1.5cqw]">
          <div className="w-[3cqw] h-[3cqw] rounded-full border-[0.28cqw]" style={{ borderColor: AMBER, background: "rgba(245,158,11,0.2)" }} />
        </motion.div>
        {/* link line once they meet */}
        <motion.div
          style={{ opacity: approach }}
          className="absolute left-1/2 top-1/2 h-[0.28cqw] w-[8.5cqw] -ml-[4.3cqw] -mt-[0.14cqw]"
        >
          <div className="w-full h-full" style={{ background: AMBER, boxShadow: "0 0 16px rgba(245,158,11,0.8)" }} />
        </motion.div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: "2.8cqw" }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: "2.8cqw" }}
        transition={{ ...settle, delay: 0.55 }}
        className="flex flex-col items-center mt-[5.2cqw]"
      >
        <span
          className="inline-flex items-center gap-[1.5cqw] rounded-full border-[0.19cqw] px-[3.7cqw] py-[1.5cqw] text-[3.5cqw] font-black tracking-[0.2em]"
          style={{ borderColor: AMBER, color: AMBER, fontFamily: "Inter, system-ui, sans-serif" }}
        >
          <span className="inline-block rounded-[0.5cqw] px-[1.1cqw] py-[0.3cqw] text-[2.8cqw] font-black" style={{ background: AMBER, color: "#0C0C0E" }}>
            QR
          </span>
          {scene.chip}
        </span>
        <p className="text-[3.3cqw] font-medium mt-[3cqw]" style={{ color: "rgba(250,250,250,0.7)", fontFamily: "Inter, system-ui, sans-serif" }}>
          {scene.subline}
        </p>
      </motion.div>
    </div>
  );
}

/* Scene 6 — Steal the bounty: type slam */
function StealScene({ scene, active, clock }: SceneProps<"steal">) {
  // Flash answers the type slam, from the clock.
  const flash = useTransform(clock, (t) => {
    const p = (t - 0.45) / 0.5;
    return p >= 0 && p <= 1 ? 0.5 * (1 - p) : 0;
  });
  return (
    <div className="absolute inset-0 bg-[#0C0C0E] flex flex-col items-center justify-center px-[7.4cqw] overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 80% 50% at 50% 50%, rgba(245,158,11,0.10), transparent 70%)" }}
      />
      {/* diagonal amber slash */}
      <motion.div
        initial={{ x: "-120%", rotate: -18 }}
        animate={active ? { x: "120%" } : { x: "-120%" }}
        transition={{ duration: 0.7, delay: 0.5, ease: easeOut }}
        className="absolute w-[160%] h-[0.74cqw]"
        style={{ background: AMBER, top: "46%", boxShadow: "0 0 40px rgba(245,158,11,0.6)" }}
      />
      <motion.h1
        initial={{ opacity: 0, scale: 1.6 }}
        animate={active ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.6 }}
        transition={{ ...settle, delay: 0.35 }}
        className="text-[11.1cqw] leading-[1.02] font-black text-center whitespace-pre-line relative z-10"
        style={{ color: "#FAFAFA", fontFamily: "Inter, system-ui, sans-serif", letterSpacing: "-0.02em" }}
      >
        {scene.headline}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: "2.2cqw" }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: "2.2cqw" }}
        transition={{ ...settle, delay: 1.0 }}
        className="text-[4.1cqw] font-semibold mt-[4.4cqw] text-center relative z-10"
        style={{ color: AMBER, fontFamily: "Inter, system-ui, sans-serif" }}
      >
        {scene.subline}
      </motion.p>
      <motion.div style={{ opacity: flash }} className="absolute inset-0 bg-[#F59E0B] z-20 pointer-events-none" />
    </div>
  );
}

/* Scene 7 — End card */
function EndScene({ scene, active }: SceneProps<"end">) {
  return (
    <div className="absolute inset-0 bg-[#0C0C0E] flex flex-col items-center justify-center">
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 70% 40% at 50% 50%, rgba(245,158,11,0.10), transparent 70%)" }}
      />
      <motion.img
        src={scene.icon}
        alt=""
        initial={{ opacity: 0, scale: 0.7 }}
        animate={active ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
        transition={{ ...settle, delay: 0.2 }}
        className="w-[18.5cqw] h-[18.5cqw] rounded-[4.4cqw] mb-[5.2cqw]"
        style={{ boxShadow: "0 0 80px rgba(245,158,11,0.25)" }}
      />
      <motion.h2
        initial={{ opacity: 0, y: "2.8cqw" }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: "2.8cqw" }}
        transition={{ ...settle, delay: 0.45 }}
        className="text-[10.2cqw] font-black leading-none"
        style={{ color: "#FAFAFA", fontFamily: "Inter, system-ui, sans-serif", letterSpacing: "0.04em" }}
      >
        {scene.wordmark}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: "2.2cqw" }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: "2.2cqw" }}
        transition={{ ...settle, delay: 0.75 }}
        className="text-[4.8cqw] font-black tracking-[0.18em] mt-[3.2cqw]"
        style={{ color: AMBER, fontFamily: "Inter, system-ui, sans-serif" }}
      >
        {scene.line}
      </motion.p>
    </div>
  );
}
