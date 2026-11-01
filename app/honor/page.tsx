import HonorBoard, { metadata } from "@/components/HonorBoard";
import { centerForHost } from "@/lib/centerServer";

// لوحة الشرف on a centre's own domain; on the platform it is /{slug}/honor.
export const dynamic = "force-dynamic";
export { metadata };

export default async function HonorPage() {
  return <HonorBoard center={await centerForHost()} />;
}
