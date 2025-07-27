import Navbar from "@/modules/home/ui/components/navbar";
import { GridPattern } from "@/components/magicui/grid-pattern";
import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
}

const Layout = ({ children }: Props) => {
  return (
    <main className="flex flex-col min-h-screen max-h-screen">
      <Navbar />
      <GridPattern
        width={80}
        height={80}
        x={-1}
        y={-1}
        strokeDasharray={"4 2"}
        className={cn(
          // Mobile (default)
          "[mask-image:radial-gradient(300px_circle_at_center,white,transparent)]",
          // Tablet (md breakpoint: 768px and up)
          "md:[mask-image:radial-gradient(400px_circle_at_center,white,transparent)]",
          // Laptop (lg breakpoint: 1024px and up)
          "lg:[mask-image:radial-gradient(700px_circle_at_center,white,transparent)]",
          // Other classes
          "-z-10",
        )}
      />
      <div className="flex flex-1 flex-col px-4 pv-4">{children}</div>
    </main>
  );
};
export default Layout;
