// The web sidebar (frontend/js/nav.js renderShell), same labels and order,
// grouped into sections for the mobile Menu tab. `flag` is the AccessRight
// column a staff login needs; `ownerOnly` pages redirect staff away on web.
export const SUPPORT_WHATSAPP = 'https://wa.me/+17073166800';

export const MENU_SECTIONS = [
  {
    title: 'Daily work',
    items: [
      { key: 'results', label: 'Result', icon: 'trophy-outline', route: '/results', flag: 'Result', tint: '#D98A00' },
      { key: 'sale-history', label: 'Find Chat', icon: 'search-outline', route: '/find-chat', flag: 'FindChat', tint: '#0EA5E9' },
      { key: 'yantri', label: 'Yantri', icon: 'grid-outline', route: '/yantri', flag: 'Yantri', tint: '#5B4CF5' },
      { key: 'pl-yantri', label: 'P&L Yantri', icon: 'trending-up-outline', route: '/yantri?mode=agent', flag: 'PLYantri', tint: '#8B5CF6' },
    ],
  },
  {
    title: 'Reports',
    items: [
      { key: 'hisab', label: 'Hisab', icon: 'calculator-outline', route: '/hisab', flag: 'Hisab', tint: '#12A150' },
      { key: 'hisab-summary', label: 'Hisab Summary', icon: 'stats-chart-outline', route: '/hisab-summary', flag: 'HisabSummary', tint: '#0F9D8F' },
      { key: 'balance', label: 'Balance', icon: 'wallet-outline', route: '/balance', flag: 'Balance', tint: '#DB2777' },
      { key: 'lc', label: 'LC', icon: 'pie-chart-outline', route: '/lc', flag: 'LC', tint: '#E5484D' },
      { key: 'absent-customers', label: 'Absent Report', icon: 'person-remove-outline', route: '/absent-report', flag: 'AbsentReport', ownerOnly: true, tint: '#6B7280' },
    ],
  },
  {
    title: 'Money',
    items: [
      { key: 'accounts', label: 'Accounts', icon: 'cash-outline', route: '/accounts', flag: 'Accounts', tint: '#12A150' },
    ],
  },
  {
    title: 'Masters',
    items: [
      { key: 'customer', label: 'Add Contact', icon: 'people-outline', route: '/customers', flag: 'ADDContacts', tint: '#5B4CF5' },
      { key: 'game', label: 'Add Game', icon: 'game-controller-outline', route: '/games', flag: 'ADDGames', tint: '#0EA5E9' },
      { key: 'subusers', label: 'Sub User', icon: 'person-add-outline', route: '/subusers', flag: 'SubUsers', ownerOnly: true, tint: '#8B5CF6' },
    ],
  },
  {
    title: 'Account',
    items: [
      { key: 'change-password', label: 'Change Password', icon: 'lock-closed-outline', route: '/change-password', flag: 'ChangePassword', tint: '#3B4256' },
      { key: 'admin', label: 'Admin', icon: 'settings-outline', route: '/admin', superAdminOnly: true, tint: '#D98A00' },
    ],
  },
];

export function visibleItems(section, auth) {
  return section.items.filter((it) => {
    if (it.superAdminOnly) return auth.isSuperAdmin;
    if (auth.isStaff && it.ownerOnly) return false;
    return !it.flag || auth.can(it.flag);
  });
}

export function canOpen(key, auth) {
  for (const s of MENU_SECTIONS) {
    const it = s.items.find((x) => x.key === key);
    if (it) return visibleItems({ items: [it] }, auth).length > 0;
  }
  return true;
}
