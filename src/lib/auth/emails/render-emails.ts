import { createElement } from "react";
import { render } from "react-email";

import { MagicLinkEmail } from "./magic-link-email";
import { OtpEmail } from "./otp-email";

export const renderMagicLinkEmail = (url: string): Promise<string> =>
  render(createElement(MagicLinkEmail, { url }));

export const renderOtpEmail = (otp: string): Promise<string> =>
  render(createElement(OtpEmail, { otp }));
