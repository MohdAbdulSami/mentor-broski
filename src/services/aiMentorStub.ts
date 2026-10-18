import { LLMContextObject, ResourceLink } from '../types';
import { 
  IIntelligenceAdapter, 
  DeterministicIntelligenceAdapter, 
  GeminiIntelligenceAdapter, 
  IntelligenceAdapterResponse,
  ProposedAction 
} from './intelligenceAdapter';

export interface LLMResponseStubResult {
  text: string;
  resources?: ResourceLink[];
  suggestPlanTrigger?: boolean;
  proposedAction?: ProposedAction;
  simulated?: boolean;
}

/**
 * AI Response Service.
 * Connects to the Gemini Flash Edge Function via GeminiIntelligenceAdapter,
 * while maintaining backward-compatible fallback to DeterministicIntelligenceAdapter.
 */
export class LLMResponseService {
  private static adapter: IIntelligenceAdapter = new GeminiIntelligenceAdapter();

  static setAdapter(adapter: IIntelligenceAdapter): void {
    this.adapter = adapter;
  }

  static getAdapter(): IIntelligenceAdapter {
    return this.adapter;
  }

  static async generateMentorResponse(context: LLMContextObject): Promise<LLMResponseStubResult> {
    const result: IntelligenceAdapterResponse = await this.adapter.generateResponse(context);
    return {
      text: result.text,
      resources: result.resources,
      suggestPlanTrigger: result.suggestPlanTrigger,
      proposedAction: result.proposedAction,
      simulated: result.simulated
    };
  }
}
