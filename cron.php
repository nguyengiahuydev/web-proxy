<?php
/**
 * File cron nạp tiền tự động (Web Cron)
 * Bạn có thể sử dụng file này để cài đặt cron job từ các dịch vụ bên ngoài (như cron-job.org)
 * hoặc chạy trực tiếp từ trình duyệt.
 */

// URL của hệ thống Node.js của bạn
// Thay thế bằng URL thực tế của bạn nếu chạy từ server khác
$app_url = "https://ais-dev-wvxze3jt34oq4wneqnbj4u-365574749130.asia-southeast1.run.app";
$cron_endpoint = $app_url . "/api/cron/bank";

echo "--- Đang bắt đầu kiểm tra lịch sử ngân hàng ---<br>";
echo "Endpoint: " . $cron_endpoint . "<br>";

// Sử dụng cURL để gọi API
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $cron_endpoint);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    echo "Lỗi cURL: " . curl_error($ch);
} else {
    echo "HTTP Code: " . $http_code . "<br>";
    echo "Kết quả: " . $response . "<br>";
}

curl_close($ch);

echo "<br>--- Hoàn tất kiểm tra ---";
?>
