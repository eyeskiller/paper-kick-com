plugins {
    java
    id("io.papermc.paperweight.userdev") version "1.7.1"
    id("xyz.jpenilla.run-paper") version "2.3.0"
}

group = "com.kick.integration"
version = "1.3.0"
description = "Kick.com Integration for Paper Minecraft Server"

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}

tasks.withType<JavaCompile> {
    options.release.set(21)
}

repositories {
    mavenCentral()
    maven("https://repo.papermc.io/repository/maven-public/")
}

dependencies {
    paperweight.paperDevBundle("1.21-R0.1-SNAPSHOT")
    implementation("org.java-websocket:Java-WebSocket:1.5.6")
}

tasks.jar {
    from(configurations.runtimeClasspath.get().filter { it.name.contains("Java-WebSocket") }.map { if (it.isDirectory) it else zipTree(it) })
}
