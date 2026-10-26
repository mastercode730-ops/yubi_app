import { router } from 'expo-router';

// Opens the entry (chat) screen with the same query parameters the web
// passes to chat.html. SelectedPage: '1' = from Games inbox, '2' = Home, '3' = Find Chat.
export function openEntry(p) {
  const params = {
    SelectedMobile: p.mobile || '',
    GameId: String(p.gameId || ''),
    GameName: p.gameName || '',
    SelectedUID: String(p.selUID || ''),
    Rates: p.rates || '0/100-0/10-0',
    D_PComm: String(p.dPComm ?? '0'),
    D_Amt: String(p.dAmt ?? '100'),
    A_PComm: String(p.aPComm ?? '0'),
    A_Amt: String(p.aAmt ?? '10'),
    Pati_PComm: String(p.pati ?? '0'),
    ThirdPartyHissaID: String(p.hissaID ?? '0'),
    ThirdPartyHissaPer: String(p.hissaPer ?? '0'),
    ThirdPartyCommID: String(p.tpCommID ?? '0'),
    ThirdPartyDaraComm: String(p.tpDara ?? '0'),
    ThirdPartyAkharComm: String(p.tpAkhar ?? '0'),
    SelectedPage: String(p.selPage || '1'),
  };
  if (p.lastDate) params.LastMsgDate = p.lastDate;
  router.push({ pathname: '/entry', params });
}

// Value or the web's default when the param is empty.
export const param = (v, d = '') => {
  const s = Array.isArray(v) ? v[0] : v;
  return s === undefined || s === null || s === '' ? d : String(s);
};
