export interface Voting {
  id: number;
  title: string;
  master_image: string | null;
  created_at: number;
}

export interface Item {
  id: number;
  voting_id: number;
  name: string;
  image: string | null;
  sort_order: number;
}

export interface Round {
  id: number;
  voting_id: number;
  status: 'open' | 'closed';
  started_at: number;
  ended_at: number | null;
}

export interface Ballot {
  id: number;
  round_id: number;
  ranking_json: string; // JSON-encoded array of item ids in preference order
  created_at: number;
}

/** A voting with its items attached, for convenience in the UI. */
export interface VotingWithItems extends Voting {
  items: Item[];
}
