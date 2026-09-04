import type { WeaponId } from '../weapons/catalog.ts';

/**
 * Ícones vetoriais em alta fidelidade para as armas do Splinter Saloon.
 * Silhuetas estilizadas com traços western e detalhes visuais nítidos.
 */
export const WEAPON_ICONS: Record<WeaponId, string> = {
  bullet: `<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <!-- Revólver Colt / Peacemaker -->
    <path d="M21 11 H42 V14 H21 Z" fill="currentColor" fill-opacity="0.2"/>
    <path d="M39 9 L41 9 L41 11" stroke-width="1.8"/>
    <path d="M22 15.5 H36" stroke-width="1.2"/>
    <rect x="15" y="9.5" width="7" height="6.5" rx="1" fill="currentColor" fill-opacity="0.35"/>
    <line x1="18.5" y1="9.5" x2="18.5" y2="16" stroke-width="1.2"/>
    <path d="M11 9 L13 11 H15 V17 H12 L9 26 C8.5 28 10 29 12.5 28.5 L15 25 C16 23.5 16 20 16 18" fill="currentColor" fill-opacity="0.15"/>
    <path d="M12 9 C11 7.8 9.5 8.2 10 10.5" stroke-width="1.5"/>
    <path d="M15 18 C15 21.5 18.5 22 20 18" stroke-width="1.4"/>
    <path d="M17.5 18 C17.5 19.5 18.5 20 18.5 20" stroke-width="1.4"/>
  </svg>`,

  shotgun: `<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <!-- Espingarda de cano duplo -->
    <path d="M18 11.5 H44 V14 H18 Z" fill="currentColor" fill-opacity="0.25"/>
    <path d="M18 14 H44 V16.5 H18 Z" fill="currentColor" fill-opacity="0.25"/>
    <circle cx="43" cy="10.5" r="0.9" fill="currentColor"/>
    <path d="M22 16.5 H32 C32 18.5 22 18.5 22 16.5 Z" fill="currentColor"/>
    <path d="M13 11 H18 V17.5 H14 Z" fill="currentColor" fill-opacity="0.35"/>
    <path d="M14 9 L15.5 11" stroke-width="1.6"/>
    <path d="M13 12.5 L6 16 C4 17 3 20 4 23.5 L7 24 C10 23 12 18 14 17.5 Z" fill="currentColor" fill-opacity="0.2"/>
    <path d="M13 18 C13 21 16 21 16.5 17.5" stroke-width="1.4"/>
    <path d="M14.5 18 L15 19.5" stroke-width="1.4"/>
  </svg>`,

  rifle: `<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <!-- Rifle Winchester de alavanca -->
    <path d="M19 11 H45 V13 H19 Z" fill="currentColor" fill-opacity="0.2"/>
    <path d="M20 13 H43 V14.5 H20 Z" fill="currentColor" fill-opacity="0.2"/>
    <path d="M42 9.5 L44 9.5 V11" stroke-width="1.4"/>
    <line x1="24" y1="10" x2="25" y2="11" stroke-width="1.4"/>
    <rect x="36" y="10.5" width="1.5" height="4.5" fill="currentColor"/>
    <path d="M21 14.5 H33 V16.5 H21 Z" fill="currentColor"/>
    <rect x="13" y="10.5" width="7" height="6.5" rx="0.5" fill="currentColor" fill-opacity="0.35"/>
    <!-- Alavanca sob a coronha -->
    <path d="M13 17 C13 22 17 23 18 19 L19 17" stroke-width="1.5"/>
    <circle cx="15.5" cy="20" r="1.8" stroke-width="1.2"/>
    <!-- Coronha de madeira -->
    <path d="M13 12 L5 16 C3.5 17 3 20 3.5 23 L6.5 23.5 C9 21.5 11 17.5 13 17 Z" fill="currentColor" fill-opacity="0.2"/>
  </svg>`,

  bomb: `<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <!-- Feixe de dinamites com pavio aceso -->
    <rect x="14" y="11" width="20" height="4.2" rx="1" fill="currentColor" fill-opacity="0.3"/>
    <rect x="14" y="15.5" width="20" height="4.2" rx="1" fill="currentColor" fill-opacity="0.4"/>
    <rect x="14" y="20" width="20" height="4.2" rx="1" fill="currentColor" fill-opacity="0.3"/>
    <rect x="18" y="10.5" width="2.5" height="14.5" fill="currentColor"/>
    <rect x="27" y="10.5" width="2.5" height="14.5" fill="currentColor"/>
    <!-- Pavio retorcido -->
    <path d="M14 13 C10 12 9 8 12 6 C14 4.5 17 5.5 18 3.5" stroke-width="1.5"/>
    <!-- Faíscas douradas -->
    <path d="M18 3.5 L19 1" stroke-width="1.5"/>
    <path d="M20 3.5 L22 2.5" stroke-width="1.5"/>
    <path d="M18 1.5 L15 0.5" stroke-width="1.5"/>
    <circle cx="18" cy="3.5" r="1.5" fill="currentColor"/>
  </svg>`,

  laser: `<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <!-- Pistola laser retrô / Raio de energia -->
    <line x1="43" y1="10" x2="43" y2="16" stroke-width="2"/>
    <line x1="39" y1="11" x2="39" y2="15" stroke-width="1.6"/>
    <line x1="35" y1="11" x2="35" y2="15" stroke-width="1.6"/>
    <path d="M28 12.5 H42" stroke-width="2"/>
    <path d="M44 13 L47 13" stroke-width="2.5" stroke-dasharray="1 1"/>
    <!-- Câmara de plasma -->
    <rect x="20" y="10" width="9" height="6" rx="2" fill="currentColor" fill-opacity="0.3"/>
    <line x1="22" y1="13" x2="27" y2="13" stroke-width="1.5"/>
    <!-- Corpo e punho -->
    <path d="M13 9 H20 V17 H15 L10 26 C9 27.5 11 28.5 13 27.5 L17 22 C18 20 18 18 19 17 Z" fill="currentColor" fill-opacity="0.2"/>
    <path d="M15 9 L17 6 L21 9" stroke-width="1.4"/>
    <path d="M15 17 C15 20.5 18 20.5 19 17" stroke-width="1.3"/>
  </svg>`,

  water: `<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <!-- Lançador de água pressurizado -->
    <rect x="17" y="7" width="17" height="5.5" rx="2.5" fill="currentColor" fill-opacity="0.35"/>
    <line x1="19.5" y1="7" x2="19.5" y2="12.5" stroke-width="1"/>
    <!-- Cano e bico injetor -->
    <path d="M13 13 H39 V16 H17 Z" fill="currentColor" fill-opacity="0.2"/>
    <path d="M39 12.5 L42.5 11.5 V17.5 L39 16.5 Z" fill="currentColor"/>
    <!-- Jatos d'água -->
    <path d="M44 12 C46 11 47 13 46 14" stroke-width="1.3"/>
    <circle cx="45" cy="16.5" r="0.9" fill="currentColor"/>
    <!-- Bomba de pressão inferior -->
    <rect x="25" y="17" width="9" height="3" rx="1" fill="currentColor"/>
    <!-- Empunhadura e gatilho -->
    <path d="M13 13 L8 25 C7.5 26.5 9.5 27.5 11.5 26.5 L15 19 Z" fill="currentColor" fill-opacity="0.2"/>
    <path d="M14 17 C14 20 17 20 17 17" stroke-width="1.3"/>
  </svg>`,

  hook: `<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <!-- Gancho / Arpéu de escalada -->
    <circle cx="8.5" cy="16" r="3" stroke-width="1.6"/>
    <path d="M2.5 16 Q5.5 14 8.5 16 Q11.5 18 14.5 16" stroke-width="1.2" stroke-dasharray="2 1.5"/>
    <!-- Haste central -->
    <line x1="11.5" y1="16" x2="33" y2="16" stroke-width="2.5"/>
    <!-- Travessão -->
    <line x1="31" y1="11" x2="31" y2="21" stroke-width="2"/>
    <!-- Garras curvas superiores e inferiores -->
    <path d="M33 16 Q40 15 40 8 Q40 6 37 7 L35 9" stroke-width="1.8"/>
    <path d="M33 16 Q40 17 40 24 Q40 26 37 25 L35 23" stroke-width="1.8"/>
    <path d="M33 14 L38 16 L33 18 Z" fill="currentColor"/>
  </svg>`,

  detonator: `<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <!-- Caixa detonadora de dinamite (Blasting machine) -->
    <rect x="15" y="13.5" width="18" height="15.5" rx="1.5" fill="currentColor" fill-opacity="0.25"/>
    <line x1="15" y1="18" x2="33" y2="18" stroke-width="0.9" stroke-opacity="0.6"/>
    <!-- Terminais de cobre -->
    <rect x="17" y="11" width="2.5" height="2.5" fill="currentColor"/>
    <rect x="28.5" y="11" width="2.5" height="2.5" fill="currentColor"/>
    <!-- Fios de faísca -->
    <path d="M18 11 Q14 8.5 11.5 9.5" stroke-width="1.2"/>
    <path d="M30 11 Q34 8.5 36.5 9.5" stroke-width="1.2"/>
    <!-- Haste do pistão -->
    <line x1="24" y1="5.5" x2="24" y2="13.5" stroke-width="2.2"/>
    <!-- Manopla em T -->
    <rect x="16.5" y="3.5" width="15" height="3" rx="1" fill="currentColor"/>
    <circle cx="24" cy="5" r="0.7" fill="#24180f"/>
  </svg>`,
};

export function weaponIconSvg(id: WeaponId): string {
  return WEAPON_ICONS[id] ?? '';
}
