import Header from "components/Header"
import Sidebar from "components/Sidebar"
import Footer from "components/Footer"
import type { ReactElement } from "react"

export default function Layout({
  children,
}: {
  children: HTMLElement | ReactElement | ReactElement[];
}) {
  return (
    <>
      <Sidebar />
      <Header />
      <div>{children}</div>
      <Footer />
    </>
  );
}
