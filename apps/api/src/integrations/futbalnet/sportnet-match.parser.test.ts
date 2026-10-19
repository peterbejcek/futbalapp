import { describe, expect, it } from 'vitest';
import { parseSportnetMatch, parseSportnetMatchUrl } from './sportnet-match.parser';

// zjednodušený RSC payload (úvodzovky escapované ako \")
const payload = String.raw`<script>self.__next_f.push([1,"{\"protocol\":{\"matchNr\":\"1\",\"events\":[{\"eventType\":\"goal\",\"type\":\"goal_game\",\"player\":{\"_id\":\"p1\",\"name\":\"Sebastián Vaňo\"},\"team\":\"t1\",\"phase\":\"1HT\",\"eventTime\":\"20:00\"},{\"eventType\":\"goal\",\"type\":\"goal_penalty\",\"player\":{\"name\":\"Ján Hosť\"},\"team\":\"t2\",\"phase\":\"2HT\",\"eventTime\":\"41:30\"}],\"audience\":3},\"score\":[1,1],\"teams\":[{\"_id\":\"t1\",\"name\":\"Domáci\"},{\"_id\":\"t2\",\"name\":\"FK Košická Nová Ves\"}],\"homeTeam\":{\"name\":\"Domáci\",\"score\":1},\"awayTeam\":{\"name\":\"FK Košická Nová Ves\",\"score\":1}}"])</script>`;

describe('parseSportnetMatch', () => {
  it('vytiahne skóre, tímy a góly', () => {
    const r = parseSportnetMatch(payload)!;
    expect(r.homeName).toBe('Domáci');
    expect([r.scoreHome, r.scoreAway]).toEqual([1, 1]);
    expect(r.goals).toEqual([
      { teamId: 't1', player: 'Sebastián Vaňo', minute: 20, penalty: false, ownGoal: false },
      { teamId: 't2', player: 'Ján Hosť', minute: 41, penalty: true, ownGoal: false },
    ]);
  });
  it('bez protokolu vráti null', () => expect(parseSportnetMatch('<html></html>')).toBeNull());
  it('rozparsuje odkaz na zápas', () => {
    expect(parseSportnetMatchUrl('https://sportnet.sme.sk/futbalnet/z/vsfz/zapas/6a5df7f4705f8e9a4941ee5d/')).toEqual({
      appSpace: 'vsfz',
      id: '6a5df7f4705f8e9a4941ee5d',
    });
  });
});
