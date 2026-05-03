-- Sa se kòd pou w kouri anndan pati "SQL Editor" sou sit Supabase la.
-- Li pral kreye tab la kote tout peman yo pral anrejistre a.

CREATE TABLE public.peman_fleetht (
    id SERIAL PRIMARY KEY,
    dat_kreye TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    dat TEXT NOT NULL,
    non_chofe TEXT NOT NULL,
    moto_plak TEXT NOT NULL,
    montan_peye_htg NUMERIC DEFAULT 0,
    reta_det_htg NUMERIC DEFAULT 0,
    resevwa_pa TEXT DEFAULT 'Tioby (Bot)',
    komante TEXT DEFAULT 'Rantre pa Telegram'
);

-- Pou rann li pi sekirize, nou mete yon règ kote nenpòt moun ka li/ekri pou kounye a 
-- Piske nou poko gen sistèm login sou bot la.
ALTER TABLE public.peman_fleetht ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pèmèt bot la mete done" 
ON public.peman_fleetht FOR ALL 
USING (true)
WITH CHECK (true);
