import type { CategoryCode, EventType } from '@fkknv/shared';

/**
 * Verejné (public-safe) pohľady na dáta portálu. Zámerne neobsahujú žiadne osobné
 * údaje okrem mena, priezviska, čísla dresu, pozície a fotky (fotka LEN so súhlasom).
 * Názvy polí zodpovedajú modelom v apps/api/prisma/schema.prisma (Season, TeamCategory,
 * Team, TeamMembership, Event, Match).
 */

export type MatchStateView = 'PLANNED' | 'LIVE' | 'FINISHED' | 'CANCELLED';

export interface SeasonView {
  name: string; // Season.name, napr. „2026/2027"
  isActive: boolean;
}

export interface TeamView {
  id: string;
  categoryCode: CategoryCode; // TeamCategory.code
  categoryName: string; // TeamCategory.name
  name: string; // Team.name, napr. „U15 A"
  sortOrder: number;
}

export interface PublicPlayer {
  id: string;
  firstName: string;
  lastName: string;
  shirtNumber?: number | null;
  position?: string | null;
  /** Vyplnené iba ak má hráč súhlas so zverejnením fotky. */
  photoUrl?: string | null;
  /** Voliteľný CSS object-position výrezu fotky (napr. „62% 20%"). */
  photoPosition?: string | null;
}

export interface PublicEvent {
  id: string;
  type: EventType; // Event.type
  teamId: string;
  categoryCode: CategoryCode;
  teamName: string;
  title: string;
  startAt: string; // ISO 8601
  endAt?: string | null;
  location?: string | null; // Event.location (voľný text)
  match?: {
    opponent: string;
    isHome: boolean;
    competition?: string | null;
    scoreUs?: number | null;
    scoreThem?: number | null;
    state: MatchStateView;
  } | null;
}

export interface PublicArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  /** Odseky textu (čistý text, bez HTML). */
  body: string[];
  publishedAt: string; // ISO
  coverUrl?: string | null;
  tag?: string | null;
}

export interface EventQuery {
  categoryCode?: CategoryCode;
  type?: 'match' | 'training'; // match = zápasy (MATCH, TOURNAMENT), training = TRAINING
  from?: string; // ISO
  to?: string; // ISO
}

/** Jediný vstupný bod verejného webu k dátam. Implementácie: demo-fixtures (dočasne), API (budúce). */
export interface PublicDataSource {
  readonly isDemo: boolean;
  getActiveSeason(): Promise<SeasonView>;
  getTeams(): Promise<TeamView[]>;
  getSquad(teamId: string): Promise<PublicPlayer[]>;
  getEvents(query?: EventQuery): Promise<PublicEvent[]>;
  getEvent(id: string): Promise<PublicEvent | null>;
  listArticles(): Promise<PublicArticle[]>;
  getArticle(slug: string): Promise<PublicArticle | null>;
}
