<?php
require_once('../../php_data_api/private/initialize.php');
// require_login();
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

ini_set("xdebug.var_display_max_children", '-1');
ini_set("xdebug.var_display_max_data", '-1');
ini_set("xdebug.var_display_max_depth", '-1');

date_default_timezone_set('America/Chicago');
if (date_default_timezone_get()) {
    //echo 'date_default_timezone_set: ' . date_default_timezone_get() . '<br />';
}
if (ini_get('date.timezone')) {
    //echo 'date.timezone: ' . ini_get('date.timezone');
}
?>

<?php
// Check if the data is received
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Get the raw POST data
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    // Check if the "paragraphs" data is present
    if (isset($data['paragraphs'])) {
        // Get the paragraphs array
        $paragraphs = $data['paragraphs'];

        // Open the file for writing (create it if it doesn't exist)
        $file = fopen('netmiss_shef.txt', 'a'); // 'a' for append mode

        // Write each paragraph to the file
        foreach ($paragraphs as $paragraph) {
            fwrite($file, $paragraph . "\n"); // Add newline after each paragraph
        }

        // Close the file
        fclose($file);

        // Respond with a success message
        echo json_encode(['status' => 'success']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'No paragraphs data received']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method']);
}
?>

<?php db_disconnect($db); ?>