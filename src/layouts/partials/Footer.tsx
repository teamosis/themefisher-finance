import config from "@/config/config.json";

export default function Footer() {
  const { copyright } = config.params;

  return (
    <footer className="border-t border-border bg-card/50 mt-auto py-6 text-center text-xs text-muted-foreground print:hidden transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <p>{copyright}</p>
      </div>
    </footer>
  );
}
