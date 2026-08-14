-- Nový vzťah rodiča k hráčovi: iný príbuzný.
ALTER TYPE "GuardianRelation" ADD VALUE IF NOT EXISTS 'RELATIVE';
