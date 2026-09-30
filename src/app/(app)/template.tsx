/** Re-mounts on every navigation, so each screen gets the short page-in animation. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-pagein">{children}</div>;
}
