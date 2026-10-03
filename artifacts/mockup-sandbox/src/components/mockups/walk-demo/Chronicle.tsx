import type { ReactNode } from "react";
import "./chronicle.css";
export function Chronicle({
  children,
  page,
  frame = false,
}: {
  children: ReactNode;
  page: string;
  frame?: boolean;
}) {
  return (
    <div
      key={page}
      className={`chronicle-page${frame ? " chronicle-frame" : ""}`}
      data-book-page={page}
      style={{ height: "100%", width: "100%", minHeight: 0 }}
    >
      {children}
    </div>
  );
}
