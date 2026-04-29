export const translations = {
  en: {
    // App
    'app.name': 'Tidings',
    'app.loading': 'Loading…',

    // Auth
    'auth.signInTitle': 'Sign in to Tidings',
    'auth.signUpTitle': 'Create your account',
    'auth.email': 'Email',
    'auth.emailPlaceholder': 'you@example.com',
    'auth.password': 'Password',
    'auth.passwordPlaceholder': 'At least 6 characters',
    'auth.signIn': 'Sign In',
    'auth.signingIn': 'Signing in…',
    'auth.signUp': 'Sign Up',
    'auth.haveAccount': 'Already have an account?',
    'auth.noAccount': "Don't have an account?",
    'auth.invalidCredentials': 'Email or password is incorrect.',

    // Layout / nav
    'nav.dashboard': 'Dashboard',
    'nav.stake': 'Stake',
    'nav.community': 'Community',
    'nav.lists': 'Lists',
    'nav.compose': 'Compose',
    'nav.inbox': 'Inbox',
    'nav.history': 'History',
    'nav.admin': 'Admin',
    'nav.signOut': 'Sign Out',

    // Header menu
    'menu.language': 'Language',
    'menu.languageEnglish': 'English',
    'menu.languageSpanish': 'Español',

    // Common
    'common.save': 'Save',
    'common.saving': 'Saving…',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.add': 'Add',
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.back': 'Back',
    'common.continue': 'Continue',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.required': 'Required',
    'common.optional': '(optional)',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.search': 'Search',
    'common.loading': 'Loading…',
  },

  es: {
    // App
    'app.name': 'Tidings',
    'app.loading': 'Cargando…',

    // Auth
    'auth.signInTitle': 'Inicie sesión en Tidings',
    'auth.signUpTitle': 'Cree su cuenta',
    'auth.email': 'Correo electrónico',
    'auth.emailPlaceholder': 'usted@ejemplo.com',
    'auth.password': 'Contraseña',
    'auth.passwordPlaceholder': 'Al menos 6 caracteres',
    'auth.signIn': 'Iniciar Sesión',
    'auth.signingIn': 'Iniciando sesión…',
    'auth.signUp': 'Registrarse',
    'auth.haveAccount': '¿Ya tiene una cuenta?',
    'auth.noAccount': '¿No tiene una cuenta?',
    'auth.invalidCredentials': 'El correo o la contraseña son incorrectos.',

    // Layout / nav
    'nav.dashboard': 'Inicio',
    'nav.stake': 'Estaca',
    'nav.community': 'Comunidad',
    'nav.lists': 'Listas',
    'nav.compose': 'Redactar',
    'nav.inbox': 'Bandeja',
    'nav.history': 'Historial',
    'nav.admin': 'Administración',
    'nav.signOut': 'Cerrar Sesión',

    // Header menu
    'menu.language': 'Idioma',
    'menu.languageEnglish': 'English',
    'menu.languageSpanish': 'Español',

    // Common
    'common.save': 'Guardar',
    'common.saving': 'Guardando…',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.add': 'Agregar',
    'common.close': 'Cerrar',
    'common.confirm': 'Confirmar',
    'common.back': 'Volver',
    'common.continue': 'Continuar',
    'common.next': 'Siguiente',
    'common.previous': 'Anterior',
    'common.required': 'Requerido',
    'common.optional': '(opcional)',
    'common.error': 'Error',
    'common.success': 'Éxito',
    'common.search': 'Buscar',
    'common.loading': 'Cargando…',
  },
} as const

export type Language = keyof typeof translations
export type TranslationKey = keyof typeof translations.en
