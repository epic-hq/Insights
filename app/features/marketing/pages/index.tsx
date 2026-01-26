import { MeshGradient } from "@paper-design/shaders-react";
import {
  ArrowRight,
  BarChart2,
  Lightbulb,
  MessageSquare,
  Sparkles,
  Star,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { Link, type MetaFunction, useNavigate } from "react-router";
import MainNav from "~/components/navigation/MainNav";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

import { PATHS } from "~/paths";
import { HowItWorks, KeyBenefits } from "./benefits-how";

export const meta: MetaFunction = () => {
  return [
    { title: "UpSight - The AI-Native CRM That Actually Connects" },
    {
      name: "description",
      content:
        "Customer truth, connected. UpSight captures every customer conversation and turns them into evidence your whole team can see, search, and act on. Click any insight, see exactly who said it. Make work work.",
    },
  ];
};

export default function LandingPage() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
      <MainNav />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative w-full overflow-hidden bg-gradient-to-br from-zinc-900 via-stone-900 to-neutral-800 py-8 text-white md:py-10 lg:py-20 xl:py-20">
          {/* Background Effects */}
          <div className="pointer-events-none absolute inset-0 z-0">
            <MeshGradient
              style={{ height: "100%", width: "100%" }}
              distortion={0.9}
              swirl={0.2}
              offsetX={0}
              offsetY={0}
              scale={1.2}
              rotation={15}
              speed={0.8}
              colors={[
                "hsl(0, 0%, 8%)",
                "hsl(20, 15%, 12%)",
                "hsl(35, 25%, 18%)",
                "hsl(45, 35%, 25%)",
              ]}
            />
          </div>
          <div className="container relative mx-auto px-2 text-center md:px-6">
            <div className="mx-auto max-w-5xl space-y-8">
              <h1 className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text font-bold text-4xl text-transparent tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                <span className="whitespace-nowrap">
                  Strengthen understanding.
                </span>
                <br />
                Deepen relationships.
              </h1>

              <p className="mx-auto max-w-3xl text-white/90 text-xl leading-relaxed md:text-2xl">
                Multimodal customer insights—with receipts—for distributed
                teams.
              </p>

              <p className="mx-auto max-w-3xl text-white/70 text-lg leading-relaxed md:text-xl">
                Rich AI-driven surveys, conversation guidance, and analysis to
                help you understand what really matters.
              </p>

              <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
                <Button
                  asChild
                  size="lg"
                  className="group relative overflow-hidden bg-white px-8 py-4 font-semibold text-lg text-slate-900 shadow-2xl transition-all duration-300 hover:scale-105 hover:bg-white/95 hover:shadow-white/20"
                >
                  <Link
                    to={`${PATHS.AUTH.REGISTER}?plan=team`}
                    className="flex items-center gap-2"
                  >
                    Start Team Trial
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-white/30 bg-white/10 px-8 py-4 font-semibold text-lg text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/20"
                >
                  <a
                    href="https://cal.com/rickmoy"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Schedule Demo
                  </a>
                </Button>
              </div>

              <div className="flex items-center justify-center gap-2 text-white/80">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-medium text-sm">14-day free trial</span>
              </div>
            </div>
          </div>
        </section>

        {/* Modern spacing wrapper */}
        <div className="bg-gradient-to-b from-white via-slate-50/50 to-white">
          <div className="container mx-auto px-4 py-10 md:py-20 lg:py-20">
            <KeyBenefits />
          </div>

          <div className="container mx-auto px-4 py-10 md:py-20 lg:py-20">
            <HowItWorks onCtaClick={() => navigate(PATHS.AUTH.REGISTER)} />
          </div>
        </div>

        {/* Features Section */}
        <section
          id="features"
          className="relative w-full bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 py-10 md:py-20 lg:py-20"
        >
          {/* Subtle background pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.05),transparent_70%)]" />

          <div className="container relative mx-auto px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-8 text-center">
              <div className="space-y-6">
                <Badge className="border-orange-200 bg-orange-50 px-4 py-2 font-medium text-orange-700">
                  <Target className="mr-2 h-4 w-4" />
                  Evidence-backed decisions
                </Badge>

                <h2 className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text font-bold text-4xl text-transparent tracking-tight sm:text-5xl md:text-6xl">
                  AI can say anything.
                  <span className="bg-gradient-to-r from-orange-600 via-red-700 to-orange-700 bg-clip-text text-transparent">
                    {" "}
                    We show the proof.
                  </span>
                </h2>

                <p className="mx-auto max-w-3xl text-slate-600 text-xl leading-relaxed md:text-2xl">
                  Every AI tool gives you summaries. Only UpSight gives you
                  receipts. Trust isn't generated—it's earned.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-7xl justify-items-center gap-8 py-16 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="group hover:-translate-y-2 relative h-full w-full overflow-hidden border-0 bg-white/70 p-8 text-center shadow-lg backdrop-blur-sm transition-all duration-500 hover:bg-white hover:shadow-2xl hover:shadow-orange-400/20">
                {/* Gradient border effect */}
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-orange-400/20 via-amber-500/20 to-orange-500/20 p-[1px]">
                  <div className="h-full w-full rounded-lg bg-white/90 backdrop-blur-sm" />
                </div>

                <div className="relative flex h-full flex-col items-center">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 via-amber-500 to-orange-500 shadow-lg transition-transform duration-300 group-hover:scale-110">
                    <Zap className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="mb-4 font-bold text-slate-900 text-xl">
                    Show the Receipts
                  </h3>
                  <p className="text-base text-slate-700 leading-relaxed md:text-lg">
                    Click any insight. See exactly who said it, when, and in
                    what context. Evidence you can verify.
                  </p>
                </div>
              </Card>
              <Card className="group hover:-translate-y-2 relative h-full w-full overflow-hidden border-0 bg-white/70 p-8 text-center shadow-lg backdrop-blur-sm transition-all duration-500 hover:bg-white hover:shadow-2xl hover:shadow-amber-500/20">
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-amber-500/20 via-yellow-600/20 to-amber-600/20 p-[1px]">
                  <div className="h-full w-full rounded-lg bg-white/90 backdrop-blur-sm" />
                </div>
                <div className="relative flex h-full flex-col items-center">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 via-yellow-600 to-amber-600 shadow-lg transition-transform duration-300 group-hover:scale-110">
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="mb-4 font-bold text-slate-900 text-xl">
                    One Truth, Every Team
                  </h3>
                  <p className="text-base text-slate-700 leading-relaxed md:text-lg">
                    Sales, Product, CS — everyone sees the same customer
                    reality. No more silos, no more "I think I heard..."
                  </p>
                </div>
              </Card>
              <Card className="group hover:-translate-y-2 relative h-full w-full overflow-hidden border-0 bg-white/70 p-8 text-center shadow-lg backdrop-blur-sm transition-all duration-500 hover:bg-white hover:shadow-2xl hover:shadow-stone-500/20">
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-stone-500/20 via-neutral-600/20 to-stone-600/20 p-[1px]">
                  <div className="h-full w-full rounded-lg bg-white/90 backdrop-blur-sm" />
                </div>
                <div className="relative flex h-full flex-col items-center">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-stone-500 via-neutral-600 to-stone-600 shadow-lg transition-transform duration-300 group-hover:scale-110">
                    <BarChart2 className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="mb-4 font-bold text-slate-900 text-xl">
                    The CRM That Remembers
                  </h3>
                  <p className="text-base text-slate-700 leading-relaxed md:text-lg">
                    Your customers told you everything. Notes, calls, surveys —
                    captured and connected so nothing gets lost.
                  </p>
                </div>
              </Card>
              <Card className="group hover:-translate-y-2 relative h-full w-full overflow-hidden border-0 bg-white/70 p-8 text-center shadow-lg backdrop-blur-sm transition-all duration-500 hover:bg-white hover:shadow-2xl hover:shadow-orange-500/20">
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-orange-500/20 via-red-600/20 to-orange-600/20 p-[1px]">
                  <div className="h-full w-full rounded-lg bg-white/90 backdrop-blur-sm" />
                </div>
                <div className="relative flex h-full flex-col items-center">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-red-600 to-orange-600 shadow-lg transition-transform duration-300 group-hover:scale-110">
                    <Target className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="mb-4 font-bold text-slate-900 text-xl">
                    From Conversation to Decision
                  </h3>
                  <p className="text-base text-slate-700 leading-relaxed md:text-lg">
                    Ask any question, get answers grounded in real
                    conversations. Make decisions backed by what customers
                    actually said.
                  </p>
                </div>
              </Card>
              <Card className="group hover:-translate-y-2 relative h-full w-full overflow-hidden border-0 bg-white/70 p-8 text-center shadow-lg backdrop-blur-sm transition-all duration-500 hover:bg-white hover:shadow-2xl hover:shadow-red-600/20">
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-red-600/20 via-orange-700/20 to-red-700/20 p-[1px]">
                  <div className="h-full w-full rounded-lg bg-white/90 backdrop-blur-sm" />
                </div>
                <div className="relative flex h-full flex-col items-center">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 via-orange-700 to-red-700 shadow-lg transition-transform duration-300 group-hover:scale-110">
                    <MessageSquare className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="mb-4 font-bold text-slate-900 text-xl">
                    Grounded, Not Generated
                  </h3>
                  <p className="text-base text-slate-700 leading-relaxed md:text-lg">
                    Every insight traces back to real customer words. AI that
                    shows its work, not just its output.
                  </p>
                </div>
              </Card>
              <Card className="group hover:-translate-y-2 relative h-full w-full overflow-hidden border-0 bg-white/70 p-8 text-center shadow-lg backdrop-blur-sm transition-all duration-500 hover:bg-white hover:shadow-2xl hover:shadow-amber-600/20">
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-amber-600/20 via-yellow-700/20 to-amber-700/20 p-[1px]">
                  <div className="h-full w-full rounded-lg bg-white/90 backdrop-blur-sm" />
                </div>
                <div className="relative flex h-full flex-col items-center">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-600 via-yellow-700 to-amber-700 shadow-lg transition-transform duration-300 group-hover:scale-110">
                    <Lightbulb className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="mb-4 font-bold text-slate-900 text-xl">
                    Make Work Work
                  </h3>
                  <p className="text-base text-slate-700 leading-relaxed md:text-lg">
                    No more hunting. No more debating. Just clarity, evidence,
                    and action. Customer truth that flows freely.
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* How It Works Section */}

        {/* Call to Action Section */}
        <section className="relative w-full overflow-hidden bg-gradient-to-br from-zinc-900 via-stone-800 to-neutral-700 py-8 text-center text-white md:py-18 lg:py-20">
          {/* Background Effects */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(249,115,22,0.2),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(239,68,68,0.3),transparent_50%)]" />

          <div className="container relative mx-auto mx-auto space-y-8 px-4 md:px-6">
            <h2 className="bg-gradient-to-r from-white via-white to-white/80 bg-clip-text font-bold text-4xl text-transparent tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              Start with one project.
            </h2>
            <p className="mx-auto max-w-3xl text-white/90 text-xl leading-relaxed md:text-2xl">
              Five conversations. See what you learn. Make work work.
            </p>
            <Button
              asChild
              className="group relative overflow-hidden bg-white px-12 py-6 font-semibold text-slate-900 text-xl shadow-2xl transition-all duration-300 hover:scale-105 hover:bg-white/95 hover:shadow-white/20"
            >
              <Link
                to={PATHS.AUTH.REGISTER}
                className="flex items-center gap-3"
              >
                Start Free Trial
                <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      ;
      <footer className="flex w-full shrink-0 flex-col items-center gap-2 border-t bg-white px-4 py-6 text-gray-600 sm:flex-row md:px-6">
        <p className="text-xs">&copy; 2025 DeepLight. All rights reserved.</p>
        <nav className="flex gap-4 sm:ml-auto sm:gap-6">
          <Link
            href="#"
            className="text-xs underline-offset-4 hover:underline"
            prefetch={false}
          >
            Terms of Service
          </Link>
          <Link
            href="#"
            className="text-xs underline-offset-4 hover:underline"
            prefetch={false}
          >
            Privacy
          </Link>
          <Link
            href="#"
            className="text-xs underline-offset-4 hover:underline"
            prefetch={false}
          >
            Contact
          </Link>
        </nav>
      </footer>
    </div>
  );
}
