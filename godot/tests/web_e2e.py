import json
import os
import time
import urllib.request
from urllib.parse import urljoin

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait


BASE_URL = os.environ.get("DAIDAI_WEB_URL", "http://127.0.0.1:8080/")
TIMEOUT = 90


def create_driver(*, mobile: bool = False) -> webdriver.Chrome:
    options = Options()
    options.binary_location = os.environ["CHROME_BIN"]
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--enable-webgl")
    options.add_argument("--enable-unsafe-swiftshader")
    options.add_argument("--use-angle=swiftshader")
    options.add_argument("--lang=en-US")
    options.add_experimental_option("prefs", {"intl.accept_languages": "en-US,en"})
    if mobile:
        options.add_experimental_option(
            "mobileEmulation",
            {
                "deviceMetrics": {
                    "width": 390,
                    "height": 844,
                    "pixelRatio": 3,
                    "touch": True,
                    "mobile": True,
                },
                "userAgent": (
                    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/136 Mobile Safari/537.36"
                ),
            },
        )
    return webdriver.Chrome(
        service=Service(os.environ["CHROMEDRIVER_BIN"]),
        options=options,
    )


def state(driver: webdriver.Chrome) -> dict:
    raw = driver.execute_script(
        "return document.documentElement.dataset.daidaiState || null"
    )
    if not raw:
        return {}
    return json.loads(raw)


def wait_for_state(driver: webdriver.Chrome, predicate) -> dict:
    def condition(current):
        snapshot = state(current)
        return snapshot if predicate(snapshot) else False

    return WebDriverWait(driver, TIMEOUT).until(condition)


def dispatch_touch(driver: webdriver.Chrome, x: int, y: int) -> None:
    driver.execute_cdp_cmd(
        "Input.dispatchTouchEvent",
        {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]},
    )
    driver.execute_cdp_cmd(
        "Input.dispatchTouchEvent",
        {"type": "touchEnd", "touchPoints": []},
    )


def wait_for_game(driver: webdriver.Chrome) -> dict:
    snapshot = wait_for_state(driver, lambda value: bool(value))
    WebDriverWait(driver, TIMEOUT).until(
        lambda current: current.execute_script(
            "return !document.getElementById('status')"
        )
    )
    canvas = driver.find_element(By.ID, "canvas")
    assert canvas.is_displayed()
    assert driver.execute_script("return arguments[0].width > 0", canvas)
    return snapshot


def assert_export_links(driver: webdriver.Chrome) -> None:
    expected = {
        'link[rel="icon"]': "index.icon.png",
        'link[rel="apple-touch-icon"]': "index.apple-touch-icon.png",
    }
    for selector, filename in expected.items():
        runtime_href = driver.find_element(By.CSS_SELECTOR, selector).get_attribute("href")
        assert runtime_href and (
            runtime_href.startswith("blob:") or runtime_href.endswith(filename)
        )
        with urllib.request.urlopen(urljoin(BASE_URL, filename), timeout=30) as response:
            assert response.status == 200


def test_desktop() -> None:
    driver = create_driver()
    try:
        driver.get(urljoin(BASE_URL, "?e2e=1&quality=high"))
        snapshot = wait_for_game(driver)
        assert snapshot["paused"] is True
        assert snapshot["quality"] == "desktop"
        assert snapshot["pause_visible"] is False
        assert snapshot["mute_visible"] is True
        assert snapshot["language_visible"] is True
        assert snapshot["muted"] is False
        assert snapshot["title"] == '"DAIDAI" Worm'
        assert driver.title == snapshot["title"]
        assert_export_links(driver)

        dimensions = driver.execute_script(
            """
            const canvas = document.getElementById('canvas');
            const rect = canvas.getBoundingClientRect();
            return {
              cssWidth: rect.width,
              windowWidth: innerWidth,
              physicalWidth: canvas.width,
            };
            """
        )
        assert dimensions["cssWidth"] == dimensions["windowWidth"]
        assert dimensions["physicalWidth"] >= dimensions["cssWidth"]

        driver.find_element(By.ID, "canvas").click()
        ActionChains(driver).send_keys(Keys.ARROW_RIGHT).perform()
        snapshot = wait_for_state(driver, lambda value: value.get("paused") is False)
        assert snapshot["has_started"] is True
        snapshot = wait_for_state(
            driver, lambda value: value.get("elapsed_seconds", 0) >= 1
        )
        assert snapshot["pause_visible"] is False
        assert snapshot["mute_visible"] is False
        assert snapshot["language_visible"] is False

        driver.execute_script("window.dispatchEvent(new Event('blur'))")
        snapshot = wait_for_state(driver, lambda value: value.get("paused") is True)
        assert snapshot["message"] == "Paused"
        driver.execute_script("window.dispatchEvent(new Event('focus'))")
        time.sleep(0.2)
        assert state(driver)["paused"] is True
    finally:
        driver.quit()


def test_mobile() -> None:
    driver = create_driver(mobile=True)
    try:
        driver.get(urljoin(BASE_URL, "?e2e=1&quality=low"))
        snapshot = wait_for_game(driver)
        assert snapshot["paused"] is True
        assert snapshot["quality"] == "reduced"
        assert snapshot["pause_visible"] is True
        assert snapshot["mute_visible"] is True
        assert snapshot["language_visible"] is True
        assert snapshot["muted"] is False

        dimensions = driver.execute_script(
            """
            const canvas = document.getElementById('canvas');
            const rect = canvas.getBoundingClientRect();
            return {
              dpr: devicePixelRatio,
              cssWidth: rect.width,
              windowWidth: innerWidth,
              physicalWidth: canvas.width,
            };
            """
        )
        assert dimensions["dpr"] == 3
        assert dimensions["cssWidth"] == dimensions["windowWidth"] == 390
        assert dimensions["physicalWidth"] == 1170

        dispatch_touch(driver, 195, 422)
        snapshot = wait_for_state(driver, lambda value: value.get("paused") is False)
        assert snapshot["pause_visible"] is True
        assert snapshot["mute_visible"] is False
        assert snapshot["language_visible"] is False

        dispatch_touch(driver, 355, 76)
        snapshot = wait_for_state(driver, lambda value: value.get("paused") is True)
        assert snapshot["pause_visible"] is True
        assert snapshot["mute_visible"] is True
        assert snapshot["language_visible"] is True

        dispatch_touch(driver, 195, 422)
        time.sleep(0.25)
        assert state(driver)["paused"] is True

        dispatch_touch(driver, 355, 76)
        wait_for_state(driver, lambda value: value.get("paused") is False)
        driver.execute_script("window.dispatchEvent(new Event('blur'))")
        snapshot = wait_for_state(driver, lambda value: value.get("paused") is True)
        assert snapshot["pause_visible"] is True
        assert snapshot["mute_visible"] is True
        assert snapshot["language_visible"] is True
    finally:
        driver.quit()


if __name__ == "__main__":
    test_desktop()
    test_mobile()
    print("Godot Web browser E2E passed")
