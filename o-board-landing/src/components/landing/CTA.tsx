import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const CTA = () => {
  return (
    <section className="py-32 relative overflow-hidden">
      <div className="container mx-auto">
        <div className="relative rounded-[2rem] border border-border/60 bg-gradient-to-br from-card to-secondary/30 p-12 md:p-20 text-center overflow-hidden">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-72 w-[600px] rounded-full bg-mint/20 blur-3xl" />
          <div className="absolute -bottom-32 right-0 h-72 w-72 rounded-full bg-sakura/20 blur-3xl" />
          <span className="absolute top-8 right-10 font-mincho text-6xl text-sakura/15 select-none">桜</span>
          <span className="absolute bottom-8 left-10 font-mincho text-6xl text-mint/15 select-none">梅</span>

          <div className="relative">
            <h2 className="font-display text-4xl md:text-6xl font-bold tracking-tight">
              Ваш сад ждёт <br />
              <span className="text-gradient-sakura">первого ростка</span>
            </h2>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
              Бесплатно навсегда. Премиум — когда сами решите, что время пришло.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" className="bg-gradient-to-r from-mint to-mint-glow text-primary-foreground hover:opacity-90 px-8 h-12 shadow-glow group">
                Посадить семя
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button size="lg" variant="ghost" className="h-12 px-6">
                Связаться с нами
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};