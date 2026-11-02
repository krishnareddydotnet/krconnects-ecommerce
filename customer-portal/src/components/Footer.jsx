// Footer: copyright, links and the app version.
// The version comes from package.json, so it changes automatically when the
// version number is bumped. Handy to confirm which release is deployed.
import { version } from '../../package.json';

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span>© 2026 KRConnects e-commerce. All rights reserved.</span>
        <span>
          <a href="#">About</a> · <a href="#">Help</a> · <a href="#">Privacy</a>
          {/* Small, muted version label, e.g. "v1.7.0" */}
          <span className="app-version"> · v{version}</span>
        </span>
      </div>
    </footer>
  );
}

export default Footer;
