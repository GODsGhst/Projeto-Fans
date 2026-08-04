package com.projetofans;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.util.TimeZone;

@SpringBootApplication
public class ProjetoFansApplication {

    @Value("${app.timezone}")
    private String timezone;

    public static void main(String[] args) {
        SpringApplication.run(ProjetoFansApplication.class, args);
    }

    /**
     * A turma e local e o aviso da vespera dispara em horario local.
     * Fixar a JVM evita que o fuso do host de producao mova a notificacao de hora.
     */
    @PostConstruct
    void fixarFuso() {
        TimeZone.setDefault(TimeZone.getTimeZone(timezone));
    }
}
