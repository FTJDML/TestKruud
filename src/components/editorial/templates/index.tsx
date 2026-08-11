import type { EditorialPageType } from '@prisma/client'
import { BestOfTemplate } from '@/components/editorial/templates/BestOfTemplate'
import { BudgetGuideTemplate } from '@/components/editorial/templates/BudgetGuideTemplate'
import { ComparisonTemplate } from '@/components/editorial/templates/ComparisonTemplate'
import { DealCollectionTemplate } from '@/components/editorial/templates/DealCollectionTemplate'
import { DesignCollectionTemplate } from '@/components/editorial/templates/DesignCollectionTemplate'
import { DiscoveryCollectionTemplate } from '@/components/editorial/templates/DiscoveryCollectionTemplate'
import { GiftGuideTemplate } from '@/components/editorial/templates/GiftGuideTemplate'
import { ProblemSolutionTemplate } from '@/components/editorial/templates/ProblemSolutionTemplate'
import { UseCaseGuideTemplate } from '@/components/editorial/templates/UseCaseGuideTemplate'
import type { TemplateProps } from '@/components/editorial/templates/shared'

/** Eén template per archetype; de pagina kiest hier niets zelf. */
const templates: Record<EditorialPageType, (props: TemplateProps) => React.ReactNode> = {
  COMPARISON: ComparisonTemplate,
  BEST_OF: BestOfTemplate,
  BUDGET_GUIDE: BudgetGuideTemplate,
  USE_CASE_GUIDE: UseCaseGuideTemplate,
  GIFT_GUIDE: GiftGuideTemplate,
  DESIGN_COLLECTION: DesignCollectionTemplate,
  DEAL_COLLECTION: DealCollectionTemplate,
  PROBLEM_SOLUTION: ProblemSolutionTemplate,
  DISCOVERY_COLLECTION: DiscoveryCollectionTemplate,
}

export function EditorialTemplate({ page }: TemplateProps) {
  const Template = templates[page.type]
  return <Template page={page} />
}
