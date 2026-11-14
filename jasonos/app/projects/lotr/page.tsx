import { ProjectLinks } from "@/components/jasonos/project-links";
import { LotrMap } from "@/components/lotr/LotrMap";

export const metadata = {
  title: "LOTR Map",
  description: "Map of Middle-earth with key locations and scene highlights.",
};

export default function LotrPage() {
  return (
    <>
      <LotrMap />
      <div className="mx-auto max-w-[1100px] px-3 pb-10">
        <ProjectLinks slug="lotr" />
      </div>
    </>
  );
}
