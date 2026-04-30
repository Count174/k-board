import { Button } from "@/components/ui/button";

export const Navbar = () => {
  return (
    <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-background/60 border-b border-border/50">
      <div className="container mx-auto flex h-16 items-center justify-between">
        <a href="#" className="flex items-center gap-2.5 group">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sakura to-mint shadow-glow">
            <span className="absolute inset-0 rounded-xl bg-sakura/40 blur-md group-hover:blur-lg transition-all" />
            <span className="relative font-mincho font-bold text-primary-foreground text-sm">桜</span>
          </span>
          <span className="font-display font-semibold text-lg tracking-tight">
            <span className="text-sakura">o</span>-board
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#philosophy" className="hover:text-foreground transition-colors">Философия</a>
          <a href="#features" className="hover:text-foreground transition-colors">Возможности</a>
          <a href="#how" className="hover:text-foreground transition-colors">Путь</a>
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <a href="/login">Войти</a>
          </Button>
          <Button asChild size="sm" className="bg-gradient-to-r from-mint to-mint-glow text-primary-foreground hover:opacity-90 font-medium">
            <a href="/register">Начать</a>
          </Button>
        </div>
      </div>
    </header>
  );
};