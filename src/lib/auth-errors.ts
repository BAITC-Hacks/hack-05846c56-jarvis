import type { Locale } from './types';

/** Provider codes only: do not expose upstream diagnostics or depend on English messages. */
export function authErrorMessage(error: { code?: string; status?: number } | null | undefined, locale: Locale, codeStep = false): string {
  const ru = locale === 'ru';
  const code = (error?.code || '').toUpperCase();
  if (error?.status === 429 || /TOO_MANY|RATE_LIMIT/.test(code)) return ru ? 'Слишком много попыток. Подождите минуту и повторите.' : 'Әрекет тым көп. Бір минут күтіп, қайталаңыз.';
  if (/OTP_EXPIRED|EXPIRED_OTP|TOKEN_EXPIRED/.test(code)) return ru ? 'Срок действия кода истёк. Запросите новый код.' : 'Кодтың мерзімі аяқталды. Жаңа код сұратыңыз.';
  if (/INVALID_OTP|INVALID_TOKEN|OTP_NOT_FOUND/.test(code) || (codeStep && /VALIDATION_FAILED|BAD_JWT/.test(code))) return ru ? 'Код неверный, истёк или уже использован. Проверьте его или запросите новый.' : 'Код қате, мерзімі аяқталған немесе қолданылған. Тексеріңіз немесе жаңасын сұратыңыз.';
  if (/EMAIL_NOT_VERIFIED|EMAIL_NOT_CONFIRMED/.test(code)) return ru ? 'Подтвердите email шестизначным кодом.' : 'Email мекенжайын алты таңбалы кодпен растаңыз.';
  if (/USER_ALREADY_EXISTS|EMAIL_ALREADY_EXISTS/.test(code)) return ru ? 'Для этого email уже есть аккаунт. Войдите или установите пароль через восстановление.' : 'Бұл email үшін аккаунт бар. Кіріңіз немесе қалпына келтіру арқылы құпиясөз орнатыңыз.';
  if (/INVALID_EMAIL_OR_PASSWORD|INVALID_CREDENTIALS|INVALID_PASSWORD|USER_NOT_FOUND|IDENTITY_NOT_FOUND|CREDENTIAL_ACCOUNT_NOT_FOUND/.test(code)) return ru ? 'Email или пароль не подошли. Если раньше входили по коду, нажмите «Установить / восстановить пароль».' : 'Email немесе құпиясөз сәйкес емес. Бұрын кодпен кірсеңіз, «Құпиясөз орнату / қалпына келтіру» түймесін басыңыз.';
  if (/WEAK_PASSWORD/.test(code)) return ru ? 'Используйте пароль длиной от 8 до 128 символов.' : 'Ұзындығы 8–128 таңбалы құпиясөз қолданыңыз.';
  if (/PASSWORD_TOO_SHORT/.test(code)) return ru ? 'Пароль должен содержать не меньше 8 символов.' : 'Құпиясөз кемінде 8 таңбадан тұруы керек.';
  if (/PASSWORD_TOO_LONG/.test(code)) return ru ? 'Пароль должен содержать не больше 128 символов.' : 'Құпиясөз 128 таңбадан аспауы керек.';
  if (/INVALID_EMAIL|EMAIL_ADDRESS_INVALID/.test(code)) return ru ? 'Проверьте адрес email.' : 'Email мекенжайын тексеріңіз.';
  return ru ? 'Не удалось выполнить действие. Проверьте соединение и попробуйте ещё раз.' : 'Әрекет орындалмады. Байланысты тексеріп, қайталап көріңіз.';
}
