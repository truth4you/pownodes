import Header from "components/Header"; // Components: Header
import Footer from "components/Footer"; // Components: Footer
import type { ReactElement } from "react"; // Types

export default function Layout({
  children,
}: {
  children: HTMLElement | ReactElement | ReactElement[];
}) {
  return (
    <>
      <div className="container mx-auto px-4">
        <Header />
        <div>{children}</div>
      </div>
      <Footer />
    </>
  );
}
