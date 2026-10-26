import { Link } from "@tanstack/react-router";

export function SmartStartButton() {
  return (
    <Link to="/smartstart" aria-label="SmartStart" className="group flex flex-col items-center gap-2 text-center">
      <div className="smartstart-bezel w-full max-w-[9.5rem] rounded-[1.4rem] p-2">
        <div className="smartstart-pad relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-2xl transition-all duration-150 group-hover:brightness-110 group-active:translate-y-0.5 group-active:scale-[0.97]">
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-primary-foreground/15 to-transparent" />
          <svg aria-hidden viewBox="0 0 100 100" className="smartstart-engrave absolute inset-0 h-full w-full">
            <path d="M44 44 C 50 26, 62 20, 74 22" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M80 13 l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" fill="currentColor" />
          </svg>
          <span className="smartstart-engrave relative mt-5 font-sans text-[1.7rem] leading-[0.85] font-black tracking-tight lowercase">
            smart
            <br />
            <span className="pl-3">start</span>
          </span>
        </div>
      </div>
      <span className="text-[0.65rem] tracking-widest text-muted-foreground uppercase">Learning hub</span>
    </Link>
  );
}
