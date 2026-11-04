<?php
// Endpoint JSON per gli impegni letti dalla casella configurata sul server.
header('Content-Type: application/json; charset=utf-8');

// Configura queste variabili d'ambiente nel provider di hosting. Non inserire
// credenziali reali nel repository.
$email_user = getenv('CIRCOLARI_EMAIL_USER');
$email_pass = getenv('CIRCOLARI_EMAIL_PASSWORD');

$impegni = [];

if (function_exists('imap_open') && $email_user && $email_pass) {
    $mbox = @imap_open('{imap.gmail.com:993/imap/ssl}INBOX', $email_user, $email_pass);

    if ($mbox) {
        $emails = imap_search($mbox, 'SUBJECT "circolare" OR SUBJECT "interrogazione" OR SUBJECT "recupero"');

        if ($emails) {
            foreach ($emails as $email_id) {
                $overview = imap_fetch_overview($mbox, $email_id, 0);
                $body = imap_fetchbody($mbox, $email_id, 1);

                $subject = isset($overview[0]->subject) ? $overview[0]->subject : 'Impegno Scolastico';
                $start_date = isset($overview[0]->date) ? date('Y-m-d\TH:i:s', strtotime($overview[0]->date)) : date('Y-m-d\TH:i:s');
                $end_date = date('Y-m-d\TH:i:s', strtotime($start_date . ' +1 hour'));

                $impegni[] = [
                    'title'       => $subject,
                    'start'       => $start_date,
                    'end'         => $end_date,
                    'description' => substr(strip_tags($body), 0, 300) . '...',
                    'color'       => '#0056b3'
                ];
            }
        }
        imap_close($mbox);
    }
}

echo json_encode($impegni, JSON_UNESCAPED_UNICODE);
?>
