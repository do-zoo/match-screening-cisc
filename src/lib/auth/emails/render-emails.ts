import { createElement } from "react";
import { render } from "react-email";

import { AdminInviteEmail } from "./admin-invite-email";
import { MagicLinkEmail } from "./magic-link-email";
import { OtpEmail } from "./otp-email";

export const renderMagicLinkEmail = (url: string): Promise<string> =>
  render(createElement(MagicLinkEmail, { url }));

export const renderOtpEmail = (otp: string): Promise<string> =>
  render(createElement(OtpEmail, { otp }));

export const renderAdminInviteEmail = (
  inviteUrl: string,
  roleLabel: string,
): Promise<string> =>
  render(createElement(AdminInviteEmail, { inviteUrl, roleLabel }));
