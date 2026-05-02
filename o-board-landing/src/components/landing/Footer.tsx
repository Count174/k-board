import { Link } from "react-router-dom";

export const Footer = () => {
  return (
    <footer className="border-t border-border/60 py-12">
      <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sakura to-mint">
            <span className="font-mincho font-bold text-primary-foreground text-xs">桜</span>
          </span>
          <span className="font-display font-semibold text-foreground">
            <span className="text-sakura">o</span>-board
          </span>
          <span className="text-xs font-mincho text-sakura/70">桜梅桃李</span>
          <span className="text-xs">© {new Date().getFullYear()}</span>
        </div>
        <nav className="flex items-center gap-6">
          <Link to="/confidential" className="hover:text-foreground transition-colors">
            Политика конфиденциальности
          </Link>
          <a href="#" className="hover:text-foreground transition-colors">Условия</a>
          <a href="mailto:hi@o-board.ru" className="hover:text-foreground transition-colors">hi@o-board.ru</a>
        </nav>
      </div>
    </footer>
  );
};