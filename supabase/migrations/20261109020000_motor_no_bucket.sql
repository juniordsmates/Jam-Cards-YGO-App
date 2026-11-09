-- Simulador: o pacote do motor de regras (motor.json.gz, ~6 MB, publicado pelo pipeline
-- Database-Cards-Ygo) fica no bucket privado "camada", ao lado da camada. O bucket só aceitava
-- JSON; passa a aceitar também o arquivo comprimido (gzip). As políticas de leitura e escrita
-- continuam as mesmas (20261101000000_camada_privada.sql).
update storage.buckets
set allowed_mime_types = array['application/json', 'application/gzip']
where id = 'camada';
