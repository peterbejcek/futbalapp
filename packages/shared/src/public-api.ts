/**
 * Zmluva verejného (neautentifikovaného) API: GET /api/v1/public/*.
 * Odpovede obsahujú VÝLUČNE tieto polia (explicitný zoznam na serveri) — nikdy celé záznamy členov.
 */

export type PublicEventState = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED';

export interface PublicSeasonDto {
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface PublicClubDto {
  name: string;
  timezone: string; // IANA, napr. Europe/Bratislava
}

export interface PublicTeamDto {
  id: string;
  name: string;
  categoryCode: string;
  categoryName: string;
  sortOrder: number;
  /** Počet hráčov v súpiske (agregát, bez osobných údajov). */
  rosterSize: number;
}

export interface PublicPlayerDto {
  id: string;
  firstName: string;
  lastName: string;
  /** Relatívna URL na /public/players/:id/photo; len ak má hráč súhlas s fotkou a fotka existuje. */
  photoUrl: string | null;
}

export interface PublicSquadDto {
  team: PublicTeamDto;
  season: PublicSeasonDto;
  /** Iba hráči so súhlasom so zverejnením mena. */
  players: PublicPlayerDto[];
}

export interface PublicMatchDto {
  /** Domáci a hosťujúci podľa Match.isHome (náš klub = PublicClubDto.name + družstvo). */
  homeName: string;
  awayName: string;
  isHome: boolean;
  opponent: string;
  competition: string | null;
  /** Skóre z pohľadu domácich/hostí; null ak zápas nebol odohraný. */
  homeScore: number | null;
  awayScore: number | null;
}

export interface PublicEventDto {
  id: string;
  type: 'TRAINING' | 'MATCH' | 'TOURNAMENT';
  state: PublicEventState;
  teamId: string;
  teamName: string;
  categoryCode: string;
  categoryName: string;
  title: string;
  startAt: string; // ISO UTC
  endAt: string | null;
  location: string | null;
  match: PublicMatchDto | null;
}

export interface PublicEventsDto {
  club: PublicClubDto;
  season: PublicSeasonDto;
  events: PublicEventDto[];
}

export interface PublicArticleListItemDto {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
}

export interface PublicArticleDto extends PublicArticleListItemDto {
  /** Odseky čistého textu. */
  paragraphs: string[];
}

export interface PublicTeamsDto {
  club: PublicClubDto;
  season: PublicSeasonDto;
  teams: PublicTeamDto[];
}

export interface PublicEventDetailDto {
  club: PublicClubDto;
  event: PublicEventDto;
}
