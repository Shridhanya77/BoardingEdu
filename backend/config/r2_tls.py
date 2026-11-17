"""CA bundle for Cloudflare R2 uploads.

Botocore verifies TLS with the certifi bundle and ignores the operating
system certificate store. On Windows that store can trust the R2 endpoint
when certifi does not, which otherwise surfaces as an internal server error
during image upload. The bundle below keeps certifi and adds the OS roots.
"""

from pathlib import Path
import ssl
import tempfile

import certifi


def r2_ca_bundle() -> str:
    chunks = [Path(certifi.where()).read_text(encoding="ascii")]
    if hasattr(ssl, "enum_certificates"):
        for cert_bytes, encoding, trust in ssl.enum_certificates("root"):
            if encoding != "x509_asn" or not trust:
                continue
            chunks.append(ssl.DER_cert_to_PEM_cert(cert_bytes))
    data = "\n".join(chunks).encode("ascii")
    path = Path(tempfile.gettempdir()) / "boardingedu-r2-ca-bundle.pem"
    if not path.is_file() or path.read_bytes() != data:
        path.write_bytes(data)
    return str(path)
