-- create the extension in the "pgmq" schema
CREATE EXTENSION pgmq;

-- creates the queue
SELECT pgmq.create('transcribe');
