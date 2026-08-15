-- Nový stav dochádzky: Chorý.
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'SICK';
