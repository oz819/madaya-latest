import { CenterMark } from "@/components/center/Geo";
import { accentStyle, type PublicCenter } from "@/lib/center";

// The frame of the public pages for families (no login): the family page, the registration form
// and the honor board — with the centre's own name, logo and colours.
type Brand = Pick<PublicCenter, "name" | "logo_url" | "palette" | "primary_color">;

export default function PublicShell({ center, children }: { center?: Brand | null; children: React.ReactNode }) {
  const name = center?.name ?? "حلقات القرآن";
  return (
    <div className="app-bg" data-palette={center?.palette ?? "indigo"} style={accentStyle(center)}>
      <main className="guardian">
        <div className="guardian-brand">
          <CenterMark name={name} logo={center?.logo_url} size={56} />
          <div>
            <h1>{name}</h1>
            <span className="muted">متابعة حلقات القرآن الكريم</span>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
