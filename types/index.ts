export type Card = {
  id: string;
  question: string;
  answer: string;
  hint?: string | null;
};

export type Deck = {
  id: string;
  name: string;
  user_id: string;
  cards: Card[];
  created_at: string;
};

export type GenerateResponse = {
  deckNameSuggestion: string;
  cards: Card[];
  modelUsed: string;
};
