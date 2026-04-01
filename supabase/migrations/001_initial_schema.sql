CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS decks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deck_id UUID REFERENCES decks(id) ON DELETE CASCADE NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  hint TEXT,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS card_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  repetitions INTEGER DEFAULT 0,
  ease_factor DECIMAL DEFAULT 2.5,
  interval_days INTEGER DEFAULT 0,
  next_review_at TIMESTAMPTZ DEFAULT now(),
  last_rating INTEGER,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(card_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  streak_days INTEGER DEFAULT 0,
  last_studied_at DATE,
  total_reviewed INTEGER DEFAULT 0
);

ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'decks' AND policyname = 'Users own their decks'
  ) THEN
    CREATE POLICY "Users own their decks"
      ON decks FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cards' AND policyname = 'Users own their cards'
  ) THEN
    CREATE POLICY "Users own their cards"
      ON cards FOR ALL USING (
        EXISTS (SELECT 1 FROM decks WHERE decks.id = cards.deck_id AND decks.user_id = auth.uid())
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'card_reviews' AND policyname = 'Users own their reviews'
  ) THEN
    CREATE POLICY "Users own their reviews"
      ON card_reviews FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_stats' AND policyname = 'Users own their stats'
  ) THEN
    CREATE POLICY "Users own their stats"
      ON user_stats FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_card_reviews_due
  ON card_reviews (user_id, next_review_at)
  WHERE next_review_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON cards (deck_id, position);
