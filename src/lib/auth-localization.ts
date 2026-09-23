import type { AuthLocalization } from '@neondatabase/auth-ui';
import type { Locale } from './types';

export const authLocalization: Record<Locale, AuthLocalization> = {
  ru: {
    APP:'Jarvis', ACCOUNT:'Аккаунт', SIGN_IN:'Вход', SIGN_IN_ACTION:'Войти', SIGN_IN_DESCRIPTION:'Войдите, чтобы сохранять диалоги и возвращаться к ним.', SIGN_IN_WITH:'Войти через',
    SIGN_UP:'Регистрация', SIGN_UP_ACTION:'Создать аккаунт', SIGN_UP_DESCRIPTION:'Создайте аккаунт для личной истории диалогов.', SIGN_UP_EMAIL:'Проверьте почту для подтверждения аккаунта.', SIGN_OUT:'Выйти',
    EMAIL:'Email', EMAIL_PLACEHOLDER:'you@example.com', EMAIL_REQUIRED:'Укажите email', EMAIL_OTP:'Код на почту', EMAIL_OTP_SEND_ACTION:'Получить код', EMAIL_OTP_VERIFY_ACTION:'Подтвердить код', EMAIL_OTP_DESCRIPTION:'Отправим одноразовый код на ваш email.', EMAIL_OTP_VERIFICATION_SENT:'Проверьте почту: отправлен код подтверждения.',
    PASSWORD:'Пароль', PASSWORD_PLACEHOLDER:'Введите пароль', PASSWORD_REQUIRED:'Укажите пароль', PASSWORDS_DO_NOT_MATCH:'Пароли не совпадают', PASSWORD_TOO_SHORT:'Пароль слишком короткий', PASSWORD_TOO_LONG:'Пароль слишком длинный',
    CONFIRM_PASSWORD:'Повторите пароль', CONFIRM_PASSWORD_PLACEHOLDER:'Повторите пароль', CONFIRM_PASSWORD_REQUIRED:'Повторите пароль', NAME:'Имя', NAME_PLACEHOLDER:'Ваше имя', NAME_INSTRUCTIONS:'Укажите ваше имя.',
    ALREADY_HAVE_AN_ACCOUNT:'Уже есть аккаунт?', DONT_HAVE_AN_ACCOUNT:'Нет аккаунта?', OR_CONTINUE_WITH:'Или продолжить с', CONTINUE:'Продолжить', CANCEL:'Отмена', REMEMBER_ME:'Запомнить меня',
    FORGOT_PASSWORD:'Забыли пароль?', FORGOT_PASSWORD_ACTION:'Отправить ссылку', FORGOT_PASSWORD_DESCRIPTION:'Укажите email для восстановления пароля.', FORGOT_PASSWORD_EMAIL:'Если аккаунт существует, письмо с инструкцией отправлено.', FORGOT_PASSWORD_LINK:'Забыли пароль?',
    RESET_PASSWORD:'Новый пароль', RESET_PASSWORD_ACTION:'Сохранить пароль', RESET_PASSWORD_DESCRIPTION:'Задайте новый пароль.', RESET_PASSWORD_SUCCESS:'Пароль обновлён.',
    RESEND_CODE:'Отправить код ещё раз', RESEND_VERIFICATION_EMAIL:'Отправить письмо ещё раз', SEND_VERIFICATION_CODE:'Отправить код', ONE_TIME_PASSWORD:'Одноразовый код',
    EMAIL_VERIFICATION:'Подтверждение email', EMAIL_VERIFICATION_DESCRIPTION:'Подтвердите ваш email.', EMAIL_VERIFICATION_SUCCESS:'Email подтверждён.', VERIFY_YOUR_EMAIL:'Проверьте почту', VERIFY_YOUR_EMAIL_DESCRIPTION:'Перейдите по ссылке в письме, чтобы подтвердить email.',
    INVALID_EMAIL:'Проверьте email', INVALID_EMAIL_OR_PASSWORD:'Неверный email или пароль', INVALID_PASSWORD:'Неверный пароль', INVALID_CODE:'Неверный код', INVALID_OTP:'Неверный код', OTP_EXPIRED:'Код истёк. Запросите новый.', OTP_HAS_EXPIRED:'Код истёк. Запросите новый.',
    EMAIL_NOT_VERIFIED:'Сначала подтвердите email.', USER_ALREADY_EXISTS:'Аккаунт с этим email уже существует.', USER_NOT_FOUND:'Аккаунт не найден.', SESSION_EXPIRED:'Сессия истекла. Войдите снова.', TOO_MANY_ATTEMPTS:'Слишком много попыток. Повторите позже.', TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE:'Слишком много попыток. Запросите новый код.',
    UNEXPECTED_ERROR:'Не удалось выполнить запрос. Повторите.', UNKNOWN_ERROR:'Не удалось выполнить запрос. Повторите.', SERVICE_UNAVAILABLE:'Сервис временно недоступен.', FAILED_TO_GET_SESSION:'Не удалось проверить сессию.', FAILED_TO_CREATE_USER:'Не удалось создать аккаунт.', FAILED_TO_CREATE_SESSION:'Не удалось войти.', VERIFICATION_FAILED:'Подтверждение не удалось.',
  },
  kk: {
    APP:'Jarvis', ACCOUNT:'Аккаунт', SIGN_IN:'Кіру', SIGN_IN_ACTION:'Кіру', SIGN_IN_DESCRIPTION:'Диалогтарды сақтау және оларға оралу үшін кіріңіз.', SIGN_IN_WITH:'Арқылы кіру',
    SIGN_UP:'Тіркелу', SIGN_UP_ACTION:'Аккаунт жасау', SIGN_UP_DESCRIPTION:'Диалогтардың жеке тарихы үшін аккаунт жасаңыз.', SIGN_UP_EMAIL:'Аккаунтты растау үшін поштаңызды тексеріңіз.', SIGN_OUT:'Шығу',
    EMAIL:'Email', EMAIL_PLACEHOLDER:'you@example.com', EMAIL_REQUIRED:'Email енгізіңіз', EMAIL_OTP:'Поштаға код', EMAIL_OTP_SEND_ACTION:'Код алу', EMAIL_OTP_VERIFY_ACTION:'Кодты растау', EMAIL_OTP_DESCRIPTION:'Email мекенжайыңызға бір реттік код жібереміз.', EMAIL_OTP_VERIFICATION_SENT:'Поштаңызды тексеріңіз: растау коды жіберілді.',
    PASSWORD:'Құпиясөз', PASSWORD_PLACEHOLDER:'Құпиясөзді енгізіңіз', PASSWORD_REQUIRED:'Құпиясөз енгізіңіз', PASSWORDS_DO_NOT_MATCH:'Құпиясөздер сәйкес келмейді', PASSWORD_TOO_SHORT:'Құпиясөз тым қысқа', PASSWORD_TOO_LONG:'Құпиясөз тым ұзын',
    CONFIRM_PASSWORD:'Құпиясөзді қайталаңыз', CONFIRM_PASSWORD_PLACEHOLDER:'Құпиясөзді қайталаңыз', CONFIRM_PASSWORD_REQUIRED:'Құпиясөзді қайталаңыз', NAME:'Аты', NAME_PLACEHOLDER:'Сіздің атыңыз', NAME_INSTRUCTIONS:'Атыңызды енгізіңіз.',
    ALREADY_HAVE_AN_ACCOUNT:'Аккаунтыңыз бар ма?', DONT_HAVE_AN_ACCOUNT:'Аккаунтыңыз жоқ па?', OR_CONTINUE_WITH:'Немесе жалғастыру', CONTINUE:'Жалғастыру', CANCEL:'Бас тарту', REMEMBER_ME:'Мені есте сақтау',
    FORGOT_PASSWORD:'Құпиясөзді ұмыттыңыз ба?', FORGOT_PASSWORD_ACTION:'Сілтеме жіберу', FORGOT_PASSWORD_DESCRIPTION:'Құпиясөзді қалпына келтіру үшін email енгізіңіз.', FORGOT_PASSWORD_EMAIL:'Аккаунт бар болса, нұсқаулық хат жіберілді.', FORGOT_PASSWORD_LINK:'Құпиясөзді ұмыттыңыз ба?',
    RESET_PASSWORD:'Жаңа құпиясөз', RESET_PASSWORD_ACTION:'Құпиясөзді сақтау', RESET_PASSWORD_DESCRIPTION:'Жаңа құпиясөз орнатыңыз.', RESET_PASSWORD_SUCCESS:'Құпиясөз жаңартылды.',
    RESEND_CODE:'Кодты қайта жіберу', RESEND_VERIFICATION_EMAIL:'Хатты қайта жіберу', SEND_VERIFICATION_CODE:'Код жіберу', ONE_TIME_PASSWORD:'Бір реттік код',
    EMAIL_VERIFICATION:'Email растау', EMAIL_VERIFICATION_DESCRIPTION:'Email мекенжайыңызды растаңыз.', EMAIL_VERIFICATION_SUCCESS:'Email расталды.', VERIFY_YOUR_EMAIL:'Поштаңызды тексеріңіз', VERIFY_YOUR_EMAIL_DESCRIPTION:'Email растау үшін хаттағы сілтемеге өтіңіз.',
    INVALID_EMAIL:'Email мекенжайын тексеріңіз', INVALID_EMAIL_OR_PASSWORD:'Email немесе құпиясөз қате', INVALID_PASSWORD:'Құпиясөз қате', INVALID_CODE:'Код қате', INVALID_OTP:'Код қате', OTP_EXPIRED:'Код мерзімі өтті. Жаңасын сұраңыз.', OTP_HAS_EXPIRED:'Код мерзімі өтті. Жаңасын сұраңыз.',
    EMAIL_NOT_VERIFIED:'Алдымен email растаңыз.', USER_ALREADY_EXISTS:'Осы email бар аккаунт тіркелген.', USER_NOT_FOUND:'Аккаунт табылмады.', SESSION_EXPIRED:'Сессия мерзімі өтті. Қайта кіріңіз.', TOO_MANY_ATTEMPTS:'Әрекет тым көп. Кейінірек көріңіз.', TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE:'Әрекет тым көп. Жаңа код сұраңыз.',
    UNEXPECTED_ERROR:'Сұрау орындалмады. Қайталаңыз.', UNKNOWN_ERROR:'Сұрау орындалмады. Қайталаңыз.', SERVICE_UNAVAILABLE:'Қызмет уақытша қолжетімсіз.', FAILED_TO_GET_SESSION:'Сессия тексерілмеді.', FAILED_TO_CREATE_USER:'Аккаунт жасалмады.', FAILED_TO_CREATE_SESSION:'Кіру мүмкін болмады.', VERIFICATION_FAILED:'Растау сәтсіз аяқталды.',
  },
};
