// Loaded before every test file: the tests never open the local copy of the site's database (data/kickoff.db) nor Turso.
// Several test files run at once; sharing one file made them update it together after a schema change.
// libsql's native module could crash ("Segmentation fault") while a test process tore down, after every test had passed, and the
// runner then failed the whole file: that was the flaky test. package.json runs the tests with --test-force-exit, which leaves at once.
process.env.DATABASE_PATH = ":memory:";
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
