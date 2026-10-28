import { InstagramIcon } from "@/components/SocialIcons";

// Developer signature on the login page: full in the footer, a single line inside the login dialog.
export default function DevCredit({ compact = false }: { compact?: boolean }) {
  return (
    <a
      className={`dev-credit${compact ? " compact" : ""}`}
      href="https://www.instagram.com/osama.z.saifaldin/"
      target="_blank"
      rel="noopener noreferrer"
      dir="ltr"
      aria-label="Developed by Osama Zaid Saif Aldin on Instagram"
    >
      <span className="dev-by">DEVELOPED BY</span>
      <span className="dev-name">Osama Zaid Saif Aldin</span>
      <span className="dev-ig" aria-hidden="true"><InstagramIcon /></span>
    </a>
  );
}
