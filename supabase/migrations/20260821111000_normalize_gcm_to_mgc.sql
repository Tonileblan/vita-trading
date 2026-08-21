-- Migration: Actualizar símbolo GCM / GC a MGC en todas las operaciones y estrategias
UPDATE public.trades
SET symbol = 'MGC'
WHERE symbol ILIKE 'GCM%' OR symbol = 'GC' OR symbol ILIKE 'GOLD%' OR symbol = 'XAUUSD';

UPDATE public.strategies
SET main_symbol = 'MGC'
WHERE main_symbol ILIKE 'GCM%' OR main_symbol = 'GC';
