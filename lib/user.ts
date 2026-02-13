import Cookies from 'js-cookie';

const USER_ID_COOKIE = 'ai_space_user_id';
const COOKIE_EXPIRES = 365; // 1年間有効

// ユーザーIDの取得または生成
export function getUserId(): string {
  let userId = Cookies.get(USER_ID_COOKIE);
  
  if (!userId) {
    userId = Math.floor(1000 + Math.random() * 9000).toString();
    Cookies.set(USER_ID_COOKIE, userId, { expires: COOKIE_EXPIRES });
  }
  
  return userId;
}

// ユーザーIDを設定
export function setUserId(userId: string): void {
  Cookies.set(USER_ID_COOKIE, userId, { expires: COOKIE_EXPIRES });
}

// ユーザーIDをクリア
export function clearUserId(): void {
  Cookies.remove(USER_ID_COOKIE);
}
