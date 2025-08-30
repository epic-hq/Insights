interface OnboardingStepperProps {
  currentStep: "goals" | "questions" | "upload"
}

const onboardingSteps = [
  { id: "goals", title: "Project Goals" },
  { id: "questions", title: "Questions" },
  { id: "upload", title: "Upload" },
]

export function OnboardingStepper({ currentStep }: OnboardingStepperProps) {
  return (
    <div className="mb-6 sm:mb-10">
      <div className="flex items-center justify-center space-x-8">
        {onboardingSteps.map((step, index) => (
          <div key={step.id} className="flex items-center space-x-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step.id === currentStep ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {index + 1}
            </div>
            <span
              className={`text-sm font-medium ${
                step.id === currentStep ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {step.title}
            </span>
            {index < onboardingSteps.length - 1 && <div className="ml-8 h-px w-16 bg-border" />}
          </div>
        ))}
      </div>
    </div>
  )
}