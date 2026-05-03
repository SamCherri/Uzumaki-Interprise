export const RESERVED_TICKERS = [
  'RPC','ADMIN','ADM','BANCO','BANK','EXCHANGE','TESOURARIA','TREASURY','CORRETOR','BROKER','PREFEITURA','POLICIA','POLICE','GOV','GOVERNO','STAFF','SUPORTE','SUPPORT','OFICIAL','OFFICIAL','SISTEMA','SYSTEM','SUN','CITY','SUNCITY','RPCEXCHANGE',
] as const;

export const RESERVED_NAME_TERMS = [
  'admin','administrador','adm','staff','suporte','support','oficial','official','corretor','broker','banco','tesouraria','exchange','sistema','system','governo','prefeitura','polícia','policia','police','rpc exchange','rpc-exchange',
] as const;

export const FORBIDDEN_WORDS = [
  'golpe','scam','phishing','hack','hacker','cheat','exploit','roubo','fraude',
] as const;

export const SUSPICIOUS_LINK_PATTERNS = [
  'http://','https://','www.','.com','.net','.org','.ru','.xyz','discord.gg','t.me/','bit.ly','tinyurl','wa.me',
] as const;
